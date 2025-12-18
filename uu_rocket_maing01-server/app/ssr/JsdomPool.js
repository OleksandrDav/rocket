"use strict";
const JsdomInitializer = require("./JsdomInitializer.js");
const { AsyncBlockingQueue } = require("./AsyncBlockingQueue.js");

class JsdomPool {
  /**
   * @param {object} config
   * @param {string} config.frontDistPath - Path to public folder
   * @param {string} config.indexHtml - Filename of index.html
   * @param {number} config.minInstances - How many browsers to keep open (default: 2)
   * @param {number} config.maxUses - Recycle browser after X requests (default: 50)
   */
  constructor({ frontDistPath, indexHtml, minInstances = 2, maxUses = 50 }) {
    this.config = { frontDistPath, indexHtml, minInstances, maxUses };
    this.pool = []; // Track all active instances
    this.queue = new AsyncBlockingQueue();
    this.isInitialized = false;
  }

  /**
   * Boot up the initial set of browsers.
   */
  async init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    console.log(`[JsdomPool] Warming up ${this.config.minInstances} instances...`);
    const promises = [];
    for (let i = 0; i < this.config.minInstances; i++) {
      promises.push(this._createNewInstance());
    }
    await Promise.all(promises);
    console.log(`[JsdomPool] Pool ready.`);
  }

  /**
   * INTERNAL: Creates a fresh JSDOM instance and adds it to the queue.
   */
  async _createNewInstance() {
    // We initialize to a safe "Blank" URL first.
    // The Middleware will "Hot Swap" this later.
    // Note: Use a dummy URL that matches your app's domain to avoid CORS issues.
    const dummyUrl = "http://localhost:8080/uu-rocket-maing01/22222222222222222222222222222222/home";

    const initializer = new JsdomInitializer(this.config.frontDistPath, this.config.indexHtml, {
      url: dummyUrl,
    });

    try {
      const dom = await initializer.run();

      // Tag the instance with metadata so we know when to kill it
      dom._poolMeta = {
        usageCount: 0,
        id: Math.random().toString(36).substring(7),
        createdAt: Date.now(),
      };

      this.pool.push(dom);
      this.queue.enqueue(dom);
      // console.log(`[JsdomPool] Instance ${dom._poolMeta.id} created.`);
      return dom;
    } catch (e) {
      console.error("[JsdomPool] Failed to create instance", e);
    }
  }

  /**
   * Get a running browser instance.
   */
  async acquire() {
    const dom = await this.queue.dequeue();
    dom._poolMeta.usageCount++;
    return dom;
  }

  /**
   * Return a browser instance to the pool.
   * If it's too old (usageCount > maxUses), kill it and create a new one.
   */
  async release(dom) {
    if (!dom) return;

    // 1. Check for Expiry
    if (dom._poolMeta.usageCount >= this.config.maxUses) {
      console.log(`[JsdomPool] Instance ${dom._poolMeta.id} expired (${dom._poolMeta.usageCount} uses). Recycling...`);

      // Remove from tracking array
      const index = this.pool.indexOf(dom);
      if (index > -1) this.pool.splice(index, 1);

      // Close window to free memory
      try {
        dom.window.close();
      } catch (e) {
        console.warn("[JsdomPool] Warning: Failed to close JSDOM window", e);
      }

      // Create replacement
      this._createNewInstance();
    } else {
      // 2. Clean up for next user
      // Reset global data so next request doesn't see old data
      if (dom.window.__INITIAL_DATA__) {
        delete dom.window.__INITIAL_DATA__;
      }

      // Return to line
      this.queue.enqueue(dom);
    }
  }
}

module.exports = JsdomPool;
