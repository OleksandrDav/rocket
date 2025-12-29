"use strict";

const JsdomInitializer = require("./JsdomInitializer.js");
const { AsyncBlockingQueue } = require("./AsyncBlockingQueue.js");

/**
 * JsdomPool
 * ---------
 * Manages a group of pre-loaded JSDOM instances to speed up SSR.
 * * Performance Note:
 * Creating a new JSDOM instance takes ~2000ms. By keeping a pool of already
 * started instances, we can provide a browser environment in ~0ms.
 */
class JsdomPool {
  /**
   * @param {object} config
   * @param {string} config.frontDistPath - Path to the public folder.
   * @param {string} config.indexHtml - The HTML file to load (index.html).
   * @param {number} config.minInstances - How many instances to keep ready.
   * @param {number} config.maxUses - How many times an instance is used before being replaced.
   */
  constructor({ frontDistPath, indexHtml, minInstances = 2, maxUses = 50 }) {
    this.config = { frontDistPath, indexHtml, minInstances, maxUses };
    this.pool = []; // List of all active instances
    this.queue = new AsyncBlockingQueue(); // Manages the order of requests
    this.isInitialized = false;
  }

  /**
   * Initializes the pool by creating the minimum number of instances.
   * This should be called ONLY when the server is ready (lazy init).
   */
  async init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    console.log(`[JsdomPool] Starting ${this.config.minInstances} initial instances...`);
    const promises = [];
    for (let i = 0; i < this.config.minInstances; i++) {
      promises.push(this._createNewInstance());
    }
    await Promise.all(promises);
    console.log(`[JsdomPool] Pool is ready.`);
  }

  /**
   * INTERNAL: Creates a fresh JSDOM instance and adds it to the queue.
   * We use a dummy URL to ensure the instance has a consistent origin for network calls.
   */
  async _createNewInstance() {
    const dummyUrl = "http://localhost:8080/uu-rocket-maing01/22222222222222222222222222222222/home";

    const initializer = new JsdomInitializer(this.config.frontDistPath, this.config.indexHtml, {
      url: dummyUrl,
    });

    try {
      const dom = await initializer.run();

      // Attach metadata to track the age and usage of the instance
      dom._poolMeta = {
        usageCount: 0,
        id: Math.random().toString(36).substring(7),
        createdAt: Date.now(),
      };

      this.pool.push(dom);
      this.queue.enqueue(dom);
      return dom;
    } catch (e) {
      console.error("[JsdomPool] Failed to create JSDOM instance:", e);
    }
  }

  /**
   * Takes an available instance from the pool.
   * If all instances are busy, it waits until one is released.
   * @returns {Promise<JSDOM>}
   */
  async acquire() {
    const dom = await this.queue.dequeue();
    dom._poolMeta.usageCount++;
    return dom;
  }

  /**
   * Returns an instance back to the pool after the request is finished.
   * If the instance has reached 'maxUses', it is closed and a new one is created.
   * @param {JSDOM} dom - The instance to return.
   */
  async release(dom) {
    if (!dom) return;

    // Check if the instance should be replaced to prevent memory leaks
    if (dom._poolMeta.usageCount >= this.config.maxUses) {
      console.log(`[JsdomPool] Instance ${dom._poolMeta.id} reached usage limit. Replacing...`);

      // Remove from the list of active instances
      const index = this.pool.indexOf(dom);
      if (index > -1) this.pool.splice(index, 1);

      // Close the window to free up memory
      try {
        dom.window.close();
      } catch (e) {
        console.warn("[JsdomPool] Error closing window during replacement:", e);
      }

      // Create a new fresh instance to take its place
      this._createNewInstance();
    } else {
      // Cleanup: Remove injected data so the next request starts clean
      if (dom.window.__INITIAL_DATA__) {
        delete dom.window.__INITIAL_DATA__;
      }

      // Make the instance available for the next request
      this.queue.enqueue(dom);
    }
  }
}

module.exports = JsdomPool;
