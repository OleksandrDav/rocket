const jsdom = require("jsdom");
const { JSDOM, VirtualConsole } = jsdom;
const fs = require("fs");
const path = require("path");

/**
 * Class: JsdomInitializer
 * -----------------------
 * Responsible for booting up a virtual browser environment (JSDOM) inside Node.js.
 * This is the "Engine" of Server-Side Rendering.
 *
 * It performs three critical tasks:
 * 1. Loads the `index.html` file into memory.
 * 2. Polyfills missing browser APIs (Canvas, TextEncoder, Performance) that Node.js lacks.
 * 3. Shims the `Uu5Loader` to catch the application boot sequence before scripts execute.
 */
class JsdomInitializer {
  /**
   * @param {string} frontDistPath - Absolute path to the public folder containing assets.
   * @param {string} frontDistIndexFileName - The entry file (usually 'index.html').
   * @param {object} reconfigureSettings - Custom overrides for JSDOM options (e.g., URL).
   */
  constructor(frontDistPath, frontDistIndexFileName = "index.html", reconfigureSettings = {}) {
    this.frontDistPath = frontDistPath;
    this.frontDistIndexFileName = frontDistIndexFileName;
    this.reconfigureSettings = reconfigureSettings;
  }

  /**
   * Main execution method.
   * @returns {Promise<JSDOM>} The initialized JSDOM instance with the running app.
   */
  async run() {
    const fullPath = path.join(this.frontDistPath, this.frontDistIndexFileName);
    console.log(`[SSR] Initializing JSDOM from: ${fullPath}`);

    const virtualConsole = new VirtualConsole();
    // Forward logs to terminal so we can see them
    virtualConsole.on("log", (...args) => console.log("[JSDOM]", ...args));
    virtualConsole.on("warn", (...args) => console.warn("[JSDOM Warn]", ...args));
    virtualConsole.on("error", (...args) => console.error("[JSDOM Error]", ...args));
    // CRITICAL: Swallow "jsdomError" to prevent Node.js process crash
    virtualConsole.on("jsdomError", (err) => {
      console.warn(`[JSDOM System Error - Swallowed] ${err.message}`);
    });
    // =========================================================================
    // STEP 1: JSDOM CONFIGURATION
    // =========================================================================
    // We configure JSDOM to behave like a real browser.
    const options = {
      runScripts: "dangerously", // ALLOWS <script> tags to execute (Essential for React)
      resources: "usable", // ALLOWS loading external scripts (like libraries from CDN)
      pretendToBeVisual: true, // Tells React we are in a browser environment (enables requestAnimationFrame)
      url: "http://localhost:8080/", // Default URL context (overridden by middleware)
      ...this.reconfigureSettings,
    };

    // Load the file into memory. This "starts" the browser.
    const dom = await JSDOM.fromFile(fullPath, options);

    // =========================================================================
    // STEP 2: GLOBAL SCOPE & NAVIGATOR FIXES
    // =========================================================================
    // Node.js does not have 'window' or 'document' globals. Libraries expect them.
    // We explicitly copy JSDOM's window properties to the Node.js global scope.

    global.window = dom.window;
    global.document = dom.window.document;

    // FIX: Node v22+ has a read-only 'navigator'. We must overwrite it to use JSDOM's version.
    Object.defineProperty(global, "navigator", {
      value: dom.window.navigator,
      writable: true,
      configurable: true,
    });

    // Expose other common browser globals
    global.history = dom.window.history;
    global.location = dom.window.location;
    global.HTMLElement = dom.window.HTMLElement;
    global.Element = dom.window.Element;
    global.Node = dom.window.Node;
    global.NodeFilter = dom.window.NodeFilter;
    global.DocumentFragment = dom.window.DocumentFragment;
    global.Event = dom.window.Event;
    global.CustomEvent = dom.window.CustomEvent;

    // =========================================================================
    // STEP 3: MISSING BROWSER APIs (The "Polyfills")
    // =========================================================================
    // JSDOM is lightweight and misses many modern browser APIs.
    // We manually define them here to prevent crashes.

    // 1. Auth & Crypto Polyfill
    // Fixes: "ReferenceError: TextEncoder is not defined" (Common in Auth libraries)
    const { TextEncoder, TextDecoder } = require("util");
    global.TextEncoder = TextEncoder;
    global.TextDecoder = TextDecoder;
    dom.window.TextEncoder = TextEncoder;
    dom.window.TextDecoder = TextDecoder;

    // Fixes: "AuthenticationError" (UUID generation requires crypto)
    if (!dom.window.crypto) {
      dom.window.crypto = global.crypto || require("crypto").webcrypto;
    }

    // 2. Performance API Polyfill
    // Fixes: "TypeError: Cannot read property 'responseStart' of undefined"
    // Used by telemetry libraries to measure load times.
    if (!dom.window.performance) {
      dom.window.performance = {};
    }
    dom.window.performance.getEntriesByType = (type) => {
      // Mock navigation timing data
      if (type === "navigation") {
        return [{ responseStart: 0, domInteractive: 0, domContentLoadedEventEnd: 0, loadEventEnd: 0 }];
      }
      return [];
    };
    dom.window.performance.now = () => Date.now();
    dom.window.performance.mark = () => {};
    dom.window.performance.measure = () => {};

    // 3. Observer Polyfills (Layout & Rendering)
    // Fixes: "ReferenceError: PerformanceObserver is not defined"
    dom.window.PerformanceObserver = class PerformanceObserver {
      constructor(callback) {}
      observe() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    };
    global.PerformanceObserver = dom.window.PerformanceObserver;

    // Fixes: Layout libraries checking for resize capability
    dom.window.ResizeObserver = class ResizeObserver {
      constructor(callback) {}
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    global.ResizeObserver = dom.window.ResizeObserver;

    // 4. matchMedia Polyfill
    // Fixes: Responsive design logic (e.g. mobile vs desktop views)
    dom.window.matchMedia =
      dom.window.matchMedia ||
      function (query) {
        return {
          matches: false,
          media: query,
          onchange: null,
          addListener: () => {}, // Deprecated but needed for legacy support
          removeListener: () => {},
          addEventListener: () => {}, // Modern standard
          removeEventListener: () => {},
          dispatchEvent: () => false,
        };
      };

    // 5. Canvas API Mock
    // Fixes: "TypeError: Cannot set properties of null"
    // Used by icon generation or graphical components. We provide a dummy context.
    const dummyContext = {
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 0,
      font: "",
      fillRect: () => {},
      clearRect: () => {},
      getImageData: (x, y, w, h) => ({ data: new Array(w * h * 4).fill(0) }),
      putImageData: () => {},
      createLinearGradient: () => ({ addColorStop: () => {} }),
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      closePath: () => {},
      stroke: () => {},
      fill: () => {},
      restore: () => {},
      save: () => {},
      setTransform: () => {},
      transform: () => {},
      scale: () => {},
      rotate: () => {},
      translate: () => {},
      measureText: () => ({ width: 0 }),
    };
    global.HTMLCanvasElement = dom.window.HTMLCanvasElement;
    if (global.HTMLCanvasElement) {
      global.HTMLCanvasElement.prototype.getContext = () => dummyContext;
      global.HTMLCanvasElement.prototype.toDataURL = () => "";
    }

    // =========================================================================
    // STEP 4: STANDARD MOCKS & LOADER SHIM
    // =========================================================================

    // Fetch API: Allow JSDOM to make network requests using Node's native fetch
    dom.window.fetch = global.fetch;
    dom.window.Headers = global.Headers;
    dom.window.Request = global.Request;
    dom.window.Response = global.Response;

    // Prevent OIDC Hangs: JSDOM cannot open popups, so we mock a do-nothing function.
    dom.window.open = () => ({ close: () => {}, focus: () => {}, postMessage: () => {}, closed: false });

    // Animation & Scroll Mocks: Required for React rendering loop
    global.requestAnimationFrame = (callback) => setTimeout(callback, 0);
    global.cancelAnimationFrame = (id) => clearTimeout(id);
    global.window.requestAnimationFrame = global.requestAnimationFrame;
    global.window.cancelAnimationFrame = global.cancelAnimationFrame;
    global.window.scrollTo = () => {};

    global.IntersectionObserver =
      dom.window.IntersectionObserver ||
      class IntersectionObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      };

    // -------------------------------------------------------------------------
    // THE LOADER SHIM (Race Condition Fix)
    // -------------------------------------------------------------------------
    // Problem: JSDOM runs scripts synchronously. The inline script in index.html runs
    // BEFORE the external `uu5loader.js` file finishes downloading.
    // Result: `Uu5Loader` is undefined when the app tries to start.
    //
    // Solution: We inject a "Mock Loader" immediately. It queues up the app's requests
    // and polls for the *Real* loader. When the Real loader arrives, it replays the requests.
    const mockQueue = { initData: null };
    const mockLoader = {
      initUuApp: function (...args) {
        // Queue the configuration
        mockQueue.initData = args;
      },
      import: function (url) {
        // Queue the boot request (import)
        return new Promise((resolve, reject) => {
          // Poll every 50ms for the Real Loader
          const checker = setInterval(() => {
            const currentLoader = dom.window.Uu5Loader;
            // If the global loader has changed (is no longer this mock), the real one loaded!
            if (currentLoader && currentLoader !== mockLoader) {
              clearInterval(checker);
              try {
                // 1. Replay Configuration
                if (mockQueue.initData && typeof currentLoader.initUuApp === "function") {
                  currentLoader.initUuApp(...mockQueue.initData);
                }
                // 2. Replay the Import Command
                currentLoader.import(url).then(resolve).catch(reject);
              } catch (err) {
                reject(err);
              }
            }
          }, 50);

          // Safety Timeout (15s) to prevent infinite hanging
          setTimeout(() => {
            clearInterval(checker);
          }, 15000);
        });
      },
      refreshCache: () => Promise.resolve(),
      get: () => null,
    };

    // Inject the mock into the window immediately
    dom.window.Uu5Loader = mockLoader;

    return dom;
  }
}

module.exports = JsdomInitializer;
