"use strict";

/**
 * Class: AsyncBlockingQueue
 * -------------------------
 * A First-In-First-Out (FIFO) queue designed for async/await workflows.
 *
 * Use Case in SSR:
 * Imagine you have 2 "Zombie Browsers" but 100 users hitting your site at once.
 * You cannot crash. You need a line.
 *
 * - If a browser is free, you get it instantly.
 * - If all browsers are busy, you receive a Promise that "blocks" (waits)
 * until a browser is returned to the pool.
 */
class AsyncBlockingQueue {
  constructor() {
    // Stores the actual resources (JSDOM instances) currently sitting idle.
    this.items = [];

    // Stores the "Resolve" functions of users who are waiting in line.
    this.waiters = [];
  }

  /**
   * Adds an item (JSDOM instance) back into the available pool.
   *
   * Mechanism:
   * 1. Check if anyone is waiting in line (`this.waiters`).
   * 2. If yes: Hand the item directly to the first person in line (resolve their promise).
   * 3. If no: Store the item in `this.items` for the next person who asks.
   *
   * @param {any} item - The resource to release back to the queue.
   */
  enqueue(item) {
    if (this.waiters.length > 0) {
      // ⚡ FAST PATH: Give directly to a waiter
      const resolve = this.waiters.shift();
      resolve(item);
    } else {
      // 💤 SLOW PATH: Store for later
      this.items.push(item);
    }
  }

  /**
   * Retrieves an item from the queue.
   *
   * Mechanism:
   * 1. If an item is available, return it immediately (wrapped in a resolved Promise).
   * 2. If empty, return a "Pending Promise" and add its `resolve` function to `this.waiters`.
   * This effectively "pauses" the calling code until `enqueue` is called.
   *
   * @returns {Promise<any>} A promise that resolves to the item.
   */
  dequeue() {
    if (this.items.length > 0) {
      // ✅ AVAILABLE: Return immediately
      return Promise.resolve(this.items.shift());
    } else {
      // ⏳ BUSY: Wait in line
      return new Promise((resolve) => {
        this.waiters.push(resolve);
      });
    }
  }

  /**
   * Returns the number of currently available items.
   * Does not count items currently in use.
   */
  get length() {
    return this.items.length;
  }
}

module.exports = { AsyncBlockingQueue };
