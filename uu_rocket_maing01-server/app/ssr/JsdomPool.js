"use strict";
const JsdomInitializer = require("./JsdomInitializer.js");
const { AsyncBlockingQueue } = require("./AsyncBlockingQueue.js");

/**
 * Class: JsdomPool
 * ----------------
 * Manages a pool of "Zombie Browser" instances (JSDOM).
 *
 * Why pooling?
 * - Starting JSDOM takes ~500ms (too slow for every request).
 * - Reusing JSDOM takes ~0ms (instant).
 * - We recycle instances after 'maxUses' to prevent memory leaks in the virtual DOM.
 */
class JsdomPool {
  /**
   * @param {object} config
   * @param {string} config.frontDistPath - Absolute path to the /public folder
   * @param {string} config.indexHtml - The entry file name (e.g., 'index.html')
   * @param {number} config.minInstances - Number of browsers to keep warm (default: 2)
   * @param {number} config.maxUses - Recycle browser after this many requests (default: 50)
   */
  constructor({ frontDistPath, indexHtml, minInstances = 2, maxUses = 50 }) {
    this.config = { frontDistPath, indexHtml, minInstances, maxUses };
    this.pool = []; // Keeps track of all active JSDOM objects
    this.queue = new AsyncBlockingQueue(); // FIFO Queue for handling incoming requests
    this.isInitialized = false;
  }

  /**
   * Initializes the pool by creating the minimum number of instances.
   * This should be called ONLY when the server is ready (lazy init).
   */
  async init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    console.log(`[JsdomPool] Warming up ${this.config.minInstances} instances...`);
    const promises = [];
    for (let i = 0; i < this.config.minInstances; i++) {
      promises.push(this._createNewInstance());
    }
    // Wait for all browsers to boot up before accepting traffic
    await Promise.all(promises);
    console.log(`[JsdomPool] Pool ready.`);
  }

  /**
   * INTERNAL: Creates a fresh JSDOM instance and adds it to the available queue.
   */
  async _createNewInstance() {
    // We initialize to a valid internal URL.
    // Important: The domain/port must match the server to avoid CORS issues during fetch.
    const dummyUrl = "http://localhost:8080/uu-rocket-maing01/22222222222222222222222222222222/home";

    const initializer = new JsdomInitializer(this.config.frontDistPath, this.config.indexHtml, {
      url: dummyUrl,
    });

    try {
      const dom = await initializer.run();

      // Tag the instance with metadata for lifecycle management
      dom._poolMeta = {
        usageCount: 0,
        id: Math.random().toString(36).substring(7), // Random ID for debugging
        createdAt: Date.now(),
      };

      this.pool.push(dom); // Add to tracking list
      this.queue.enqueue(dom); // Add to "Ready for Work" line
      // console.log(`[JsdomPool] Instance ${dom._poolMeta.id} created.`);
      return dom;
    } catch (e) {
      console.error("[JsdomPool] Failed to create instance", e);
    }
  }

  /**
   * Acquire a running browser instance.
   * If all browsers are busy, this returns a Promise that waits until one is free.
   * @returns {Promise<JSDOM>}
   */
  async acquire() {
    const dom = await this.queue.dequeue();
    dom._poolMeta.usageCount++;
    return dom;
  }

  /**
   * Releases a browser instance back to the pool after use.
   * Checks if the instance is "tired" (maxUses reached) and recycles it if needed.
   * @param {JSDOM} dom - The instance to release
   */
  async release(dom) {
    if (!dom) return;

    // 1. Check for Expiry (Memory Leak Protection)
    if (dom._poolMeta.usageCount >= this.config.maxUses) {
      console.log(`[JsdomPool] Instance ${dom._poolMeta.id} expired (${dom._poolMeta.usageCount} uses). Recycling...`);

      // Remove from tracking array
      const index = this.pool.indexOf(dom);
      if (index > -1) this.pool.splice(index, 1);

      // Close window to free system memory
      try {
        dom.window.close();
      } catch (e) {
        console.warn("[JsdomPool] Warning: Failed to close JSDOM window", e);
      }

      // Create a fresh replacement immediately
      this._createNewInstance();
    } else {
      // 2. Clean up for next user
      // Reset the global data injection variable so the next request starts clean
      if (dom.window.__INITIAL_DATA__) {
        delete dom.window.__INITIAL_DATA__;
      }

      // Return the instance to the back of the line
      this.queue.enqueue(dom);
    }
  }
}

module.exports = JsdomPool;
