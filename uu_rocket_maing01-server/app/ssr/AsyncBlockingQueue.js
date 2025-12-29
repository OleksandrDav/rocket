"use strict";

/**
 * AsyncBlockingQueue
 * ------------------
 * A First-In-First-Out (FIFO) queue designed for asynchronous workflows.
 * * Purpose in SSR:
 * Manages access to a limited number of JSDOM instances. If all instances
 * are currently in use, the queue provides a Promise that resolves as soon
 * as an instance is returned to the pool.
 */
class AsyncBlockingQueue {
  constructor() {
    // Array of available resources (e.g., idle JSDOM instances)
    this.items = [];

    // Array of resolve functions for pending requests waiting for a resource
    this.waiters = [];
  }

  /**
   * Adds an item back into the queue or satisfies a waiting request.
   * If there are pending requests, the item is immediately passed to the oldest one.
   * @param {any} item - The resource to be added back to the pool.
   */
  enqueue(item) {
    if (this.waiters.length > 0) {
      // Pass the item directly to the first waiting request
      const resolve = this.waiters.shift();
      resolve(item);
    } else {
      // Store the item for the next incoming request
      this.items.push(item);
    }
  }

  /**
   * Retrieves an item from the queue.
   * If the queue is empty, it returns a Promise that settles once an item is enqueued.
   * @returns {Promise<any>} A promise resolving to the available resource.
   */
  dequeue() {
    if (this.items.length > 0) {
      // Return the next available item immediately
      return Promise.resolve(this.items.shift());
    } else {
      // No items available; register the request and return a pending Promise
      return new Promise((resolve) => {
        this.waiters.push(resolve);
      });
    }
  }

  /**
   * Returns the count of idle items currently in the queue.
   * @returns {number}
   */
  get length() {
    return this.items.length;
  }
}

module.exports = { AsyncBlockingQueue };
