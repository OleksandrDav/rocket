"use strict";

/**
 * A First-In-First-Out (FIFO) queue that supports async/await.
 * If the queue is empty, 'dequeue()' returns a Promise that resolves
 * only when a new item is 'enqueue()'-ed.
 */
class AsyncBlockingQueue {
  constructor() {
    this.items = []; // Holds available JSDOM instances
    this.waiters = []; // Holds resolve functions for waiting requests
  }

  /**
   * Add an item to the queue.
   * If someone is waiting, give it to them immediately.
   * Otherwise, store it.
   */
  enqueue(item) {
    if (this.waiters.length > 0) {
      const resolve = this.waiters.shift();
      resolve(item);
    } else {
      this.items.push(item);
    }
  }

  /**
   * Get an item from the queue.
   * If empty, return a Promise and wait.
   */
  dequeue() {
    if (this.items.length > 0) {
      return Promise.resolve(this.items.shift());
    } else {
      return new Promise((resolve) => {
        this.waiters.push(resolve);
      });
    }
  }

  get length() {
    return this.items.length;
  }
}

module.exports = { AsyncBlockingQueue };
