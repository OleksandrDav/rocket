const jsdom = require("jsdom");
const { JSDOM, VirtualConsole } = jsdom;
const fs = require("fs");
const path = require("path");

/**
 * JsdomInitializer
 * ----------------
 * Orchestrates the creation of a virtual browser environment (JSDOM) within Node.js.
 * This class acts as the execution engine for Server-Side Rendering (SSR).
 *
 * Core Responsibilities:
 * 1. Document Initialization: Loads and parses the entry 'index.html'.
 * 2. API Polyfilling: Implements browser-native APIs (Canvas, Crypto, Performance) missing in Node.js.
 * 3. Lifecycle Management: Shims the Uu5Loader to synchronize the application boot sequence.
 */
class JsdomInitializer {
  /**
   * @param {string} frontDistPath - Absolute path to the directory containing build assets.
   * @param {string} frontDistIndexFileName - Name of the entry HTML file.
   * @param {object} reconfigureSettings - JSDOM configuration overrides.
   */
  constructor(frontDistPath, frontDistIndexFileName = "index.html", reconfigureSettings = {}) {
    this.frontDistPath = frontDistPath;
    this.frontDistIndexFileName = frontDistIndexFileName;
    this.reconfigureSettings = reconfigureSettings;
  }

  /**
   * Initializes and executes the virtual environment.
   * @returns {Promise<JSDOM>} The configured JSDOM instance.
   */
  async run() {
    const fullPath = path.join(this.frontDistPath, this.frontDistIndexFileName);
    console.log(`[SSR] Initializing JSDOM environment from: ${fullPath}`);

    const virtualConsole = new VirtualConsole();
    virtualConsole.on("log", (...args) => console.log("[JSDOM]", ...args));
    virtualConsole.on("warn", (...args) => console.warn("[JSDOM Warn]", ...args));
    virtualConsole.on("error", (...args) => console.error("[JSDOM Error]", ...args));

    // Suppress JSDOM internal errors (e.g., CSS parsing) to maintain server stability
    virtualConsole.on("jsdomError", (err) => {
      /* Intentionally ignored to prevent Node.js process interruption */
    });

    const options = {
      runScripts: "dangerously", // Required for executing application logic (React/uu5)
      resources: "usable", // Enables loading of external scripts and resources
      pretendToBeVisual: true, // Emulates a visual environment for layout calculations
      url: "http://localhost:8080/",
      virtualConsole,
      ...this.reconfigureSettings,

      /**
       * Configures error listeners before the DOM is parsed or scripts are executed.
       */
      beforeParse(window) {
        window.addEventListener("unhandledrejection", (event) => {
          event.preventDefault();
          console.warn(`[JSDOM Background Error] Unhandled Rejection: ${event.reason}`);
        });

        window.addEventListener("error", (event) => {
          console.warn(`[JSDOM Background Error] Script Error: ${event.message}`);
        });
      },
    };

    const dom = await JSDOM.fromFile(fullPath, options);

    // =========================================================================
    // GLOBAL ENVIRONMENT CONFIGURATION
    // =========================================================================

    /**
     * Define 'navigator' globally to satisfy library requirements before
     * window initialization. Note: Instance-specific globals (window/document)
     * are kept isolated within the JSDOM instance to prevent cross-contamination
     * during concurrent request handling.
     */
    Object.defineProperty(global, "navigator", {
      value: dom.window.navigator,
      writable: true,
      configurable: true,
    });

    // Provide standard Text encoding polyfills for authentication and data handling
    const { TextEncoder, TextDecoder } = require("util");
    global.TextEncoder = TextEncoder;
    global.TextDecoder = TextDecoder;
    dom.window.TextEncoder = TextEncoder;
    dom.window.TextDecoder = TextDecoder;

    // =========================================================================
    // BROWSER API POLYFILLS
    // =========================================================================

    // Web Crypto API: Required for UUID generation and security operations
    if (!dom.window.crypto) {
      dom.window.crypto = global.crypto || require("crypto").webcrypto;
    }

    // Performance API: Provides timing and navigation metrics
    if (!dom.window.performance) {
      dom.window.performance = {};
    }
    dom.window.performance.getEntriesByType = (type) => {
      if (type === "navigation") {
        return [{ responseStart: 0, domInteractive: 0, domContentLoadedEventEnd: 0, loadEventEnd: 0 }];
      }
      return [];
    };
    dom.window.performance.now = () => Date.now();
    dom.window.performance.mark = () => {};
    dom.window.performance.measure = () => {};

    // Observer APIs: Support for modern layout and performance tracking
    dom.window.PerformanceObserver = class PerformanceObserver {
      constructor() {}
      observe() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    };

    dom.window.ResizeObserver = class ResizeObserver {
      constructor() {}
      observe() {}
      unobserve() {}
      disconnect() {}
    };

    // matchMedia: Supports responsive logic and component queries
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

    // Canvas API: Provides a mock context to prevent failures in graphical components
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

    if (dom.window.HTMLCanvasElement) {
      dom.window.HTMLCanvasElement.prototype.getContext = () => dummyContext;
      dom.window.HTMLCanvasElement.prototype.toDataURL = () => "";
    }

    // =========================================================================
    // NETWORK & ASYNC MOCKS
    // =========================================================================

    // Bind Node.js native Fetch API to the JSDOM window
    dom.window.fetch = global.fetch;
    dom.window.Headers = global.Headers;
    dom.window.Request = global.Request;
    dom.window.Response = global.Response;

    // Prevent OIDC/Auth loops from attempting to open external windows
    dom.window.open = () => ({ close: () => {}, focus: () => {}, postMessage: () => {}, closed: false });

    // Animation frames: Required for React rendering cycles
    dom.window.requestAnimationFrame = (callback) => setTimeout(callback, 0);
    dom.window.cancelAnimationFrame = (id) => clearTimeout(id);
    dom.window.scrollTo = () => {};

    dom.window.IntersectionObserver = class IntersectionObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };

    // =========================================================================
    // UU5 LOADER SHIM
    // =========================================================================

    /**
     * Resolves race conditions between JSDOM script execution and external script loading.
     * Queues initialization calls and replays them once the real Uu5Loader is available.
     */
    const mockQueue = { initData: null };
    const mockLoader = {
      initUuApp: (...args) => {
        mockQueue.initData = args;
      },
      import: (url) => {
        return new Promise((resolve, reject) => {
          const checker = setInterval(() => {
            const currentLoader = dom.window.Uu5Loader;
            if (currentLoader && currentLoader !== mockLoader) {
              clearInterval(checker);
              try {
                if (mockQueue.initData && typeof currentLoader.initUuApp === "function") {
                  currentLoader.initUuApp(...mockQueue.initData);
                }
                currentLoader.import(url).then(resolve).catch(reject);
              } catch (err) {
                reject(err);
              }
            }
          }, 50);

          setTimeout(() => clearInterval(checker), 15000);
        });
      },
      refreshCache: () => Promise.resolve(),
      get: () => null,
    };

    dom.window.Uu5Loader = mockLoader;

    return dom;
  }
}

module.exports = JsdomInitializer;
