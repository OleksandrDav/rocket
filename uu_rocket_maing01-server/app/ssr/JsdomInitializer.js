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

    // Setup Virtual Console to pipe browser logs to the server terminal
    const virtualConsole = new VirtualConsole();
    virtualConsole.on("log", (...args) => console.log("[JSDOM]", ...args));
    virtualConsole.on("warn", (...args) => console.warn("[JSDOM Warn]", ...args));
    virtualConsole.on("error", (...args) => console.error("[JSDOM Error]", ...args));
    // CRITICAL: Swallow "jsdomError" to prevent Node.js process crash due to CSS parsing/resource loading issues
    virtualConsole.on("jsdomError", (err) => {
      // Intentionally swallowed to keep server alive
      // console.warn(`[JSDOM System Error - Swallowed] ${err.message}`);
    });

    // =========================================================================
    // STEP 1: JSDOM CONFIGURATION
    // =========================================================================
    const options = {
      runScripts: "dangerously", // ALLOWS <script> tags to execute (Essential for React)
      resources: "usable", // ALLOWS loading external scripts (like libraries from CDN)
      pretendToBeVisual: true, // Tells React we are in a browser environment
      url: "http://localhost:8080/", // Default URL context (overridden by middleware)
      virtualConsole, // <--- IMPORTANT: Keep this connected!
      ...this.reconfigureSettings,

      // 🛡️ SAFETY NET: Attach listeners BEFORE scripts run
      // This prevents "Unhandled Rejections" inside JSDOM from crashing the Node.js server.
      beforeParse(window) {
        window.addEventListener("unhandledrejection", (event) => {
          event.preventDefault(); // Stop bubbling
          console.warn(`[JSDOM Background Error] Unhandled Rejection: ${event.reason}`);
        });

        window.addEventListener("error", (event) => {
          console.warn(`[JSDOM Background Error] Script Error: ${event.message}`);
        });
      },
    };

    // Load the file into memory. This "starts" the browser.
    const dom = await JSDOM.fromFile(fullPath, options);

    // =========================================================================
    // STEP 2: GLOBAL SCOPE & NAVIGATOR FIXES
    // =========================================================================

    // 🔴 POOL SAFETY: We DO NOT pollute global.window or global.document here.
    // In an instance pool, multiple JSDOMs exist simultaneously.
    // If we overwrite global.window, Instance A might try to read Instance B's document.
    //
    // global.window = dom.window;            <-- REMOVED
    // global.document = dom.window.document; <-- REMOVED

    // FIX: Node v22+ has a read-only 'navigator'. We must overwrite it to use JSDOM's version.
    // Note: We keep this one global as some libraries check `navigator` before window exists.
    Object.defineProperty(global, "navigator", {
      value: dom.window.navigator,
      writable: true,
      configurable: true,
    });

    // Polyfills usually attached to global can be kept if they are stateless (like TextEncoder).
    const { TextEncoder, TextDecoder } = require("util");
    global.TextEncoder = TextEncoder;
    global.TextDecoder = TextDecoder;
    dom.window.TextEncoder = TextEncoder;
    dom.window.TextDecoder = TextDecoder;

    // =========================================================================
    // STEP 3: MISSING BROWSER APIs (The "Polyfills")
    // =========================================================================
    // We attach these directly to the `dom.window` instance to keep them isolated.

    // 1. Crypto Polyfill (Fixes UUID generation)
    if (!dom.window.crypto) {
      dom.window.crypto = global.crypto || require("crypto").webcrypto;
    }

    // 2. Performance API Polyfill (Fixes telemetry/loading metrics)
    if (!dom.window.performance) {
      dom.window.performance = {};
    }
    dom.window.performance.getEntriesByType = (type) => {
      if (type === "navigation") {
        return [
          {
            responseStart: 0,
            domInteractive: 0,
            domContentLoadedEventEnd: 0,
            loadEventEnd: 0,
          },
        ];
      }
      return [];
    };
    dom.window.performance.now = () => Date.now();
    dom.window.performance.mark = () => {};
    dom.window.performance.measure = () => {};

    // 3. Observer Polyfills
    dom.window.PerformanceObserver = class PerformanceObserver {
      constructor(callback) {}
      observe() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    };

    dom.window.ResizeObserver = class ResizeObserver {
      constructor(callback) {}
      observe() {}
      unobserve() {}
      disconnect() {}
    };

    // 4. matchMedia Polyfill (Responsive design logic)
    dom.window.matchMedia =
      dom.window.matchMedia ||
      function (query) {
        return {
          matches: false,
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        };
      };

    // 5. Canvas API Mock (Fixes graphical components)
    const dummyContext = {
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 0,
      font: "",
      fillRect: () => {},
      clearRect: () => {},
      getImageData: (x, y, w, h) => ({
        data: new Array(w * h * 4).fill(0),
      }),
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

    // JSDOM implements HTMLCanvasElement, but we need to mock the context
    if (dom.window.HTMLCanvasElement) {
      dom.window.HTMLCanvasElement.prototype.getContext = () => dummyContext;
      dom.window.HTMLCanvasElement.prototype.toDataURL = () => "";
    }

    // =========================================================================
    // STEP 4: STANDARD MOCKS & LOADER SHIM
    // =========================================================================

    // Fetch API: Allow JSDOM to make network requests using Node's native fetch
    dom.window.fetch = global.fetch;
    dom.window.Headers = global.Headers;
    dom.window.Request = global.Request;
    dom.window.Response = global.Response;

    // Prevent OIDC Hangs: JSDOM cannot open popups
    dom.window.open = () => ({
      close: () => {},
      focus: () => {},
      postMessage: () => {},
      closed: false,
    });

    // Animation & Scroll Mocks
    dom.window.requestAnimationFrame = (callback) => setTimeout(callback, 0);
    dom.window.cancelAnimationFrame = (id) => clearTimeout(id);
    dom.window.scrollTo = () => {};

    dom.window.IntersectionObserver = class IntersectionObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };

    // -------------------------------------------------------------------------
    // THE LOADER SHIM (Race Condition Fix)
    // -------------------------------------------------------------------------
    // Captures requests made by the app before the real uu5loader arrives.
    const mockQueue = { initData: null };
    const mockLoader = {
      initUuApp: function (...args) {
        mockQueue.initData = args;
      },
      import: function (url) {
        return new Promise((resolve, reject) => {
          // Poll for Real Loader
          const checker = setInterval(() => {
            const currentLoader = dom.window.Uu5Loader;
            // Check if global loader has changed from mock to real
            if (currentLoader && currentLoader !== mockLoader) {
              clearInterval(checker);
              try {
                // 1. Replay Configuration
                if (mockQueue.initData && typeof currentLoader.initUuApp === "function") {
                  currentLoader.initUuApp(...mockQueue.initData);
                }
                // 2. Replay Import
                currentLoader.import(url).then(resolve).catch(reject);
              } catch (err) {
                reject(err);
              }
            }
          }, 50);

          // Safety Timeout (15s)
          setTimeout(() => {
            clearInterval(checker);
          }, 15000);
        });
      },
      refreshCache: () => Promise.resolve(),
      get: () => null,
    };

    // Inject the mock immediately
    dom.window.Uu5Loader = mockLoader;

    return dom;
  }
}

module.exports = JsdomInitializer;
