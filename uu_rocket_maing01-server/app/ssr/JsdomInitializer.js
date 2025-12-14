const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const fs = require("fs");
const path = require("path");

/**
 * JsdomInitializer
 * * Responsible for booting up a virtual browser environment (JSDOM) inside Node.js.
 * This class is specifically tuned to support "uu5" applications, which rely heavily on
 * global browser objects (window, document, navigator) and asynchronous script loading.
 */
class JsdomInitializer {
  /**
   * @param {string} frontDistPath - Absolute path to the folder containing built client assets (e.g., /public/uu5-client).
   * @param {string} frontDistIndexFileName - The entry HTML file (usually 'index.html').
   * @param {object} reconfigureSettings - Custom overrides for JSDOM settings (e.g., changing the URL).
   */
  constructor(frontDistPath, frontDistIndexFileName = "index.html", reconfigureSettings = {}) {
    this.frontDistPath = frontDistPath;
    this.frontDistIndexFileName = frontDistIndexFileName;
    this.reconfigureSettings = reconfigureSettings;
  }

  async run() {
    const fullPath = path.join(this.frontDistPath, this.frontDistIndexFileName);
    console.log(`[SSR] Initializing JSDOM from: ${fullPath}`);

    // =========================================================================
    // STEP 1: JSDOM CONFIGURATION (The "Base Path" Fix)
    // =========================================================================
    // CRITICAL FIX: We must merge 'reconfigureSettings' (containing the URL)
    // *before* JSDOM starts.
    //
    // The Issue: If JSDOM starts with default "about:blank" or "localhost", the
    // <script> logic inside index.html might calculate the wrong <base href>,
    // causing relative script imports (like ./index.js) to fail.
    //
    // By passing 'file://' or the correct URL here, we prevent that initial crash.
    const options = {
      runScripts: "dangerously", // Required to execute <script> tags in index.html
      resources: "usable", // Required to download external scripts (uu5loader, libraries)
      pretendToBeVisual: true, // Tells React/uu5 that we are in a browser-like environment
      url: "http://localhost:8080/", // Default fallback
      ...this.reconfigureSettings, // Overrides URL immediately
    };

    const dom = await JSDOM.fromFile(fullPath, options);

    // =========================================================================
    // STEP 2: GLOBAL SCOPE POLLUTION (The "Environment" Fix)
    // =========================================================================
    // Node.js does not have 'window' or 'document'. uu5 libraries expect them
    // to exist globally. We copy JSDOM's objects to Node's global scope.

    global.window = dom.window;
    global.document = dom.window.document;

    // CRITICAL FIX: Node.js v22+ Navigator Compatibility
    // The Issue: Node v22 introduced a native global 'navigator' object that is read-only.
    // Doing `global.navigator = dom.window.navigator` throws a TypeError.
    //
    // The Fix: We use Object.defineProperty to force-overwrite the native navigator
    // with our JSDOM version.
    Object.defineProperty(global, "navigator", {
      value: dom.window.navigator,
      writable: true,
      configurable: true,
    });

    // Copying other essential browser globals
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
    // STEP 3: MOCKS & POLYFILLS (The "Crash Prevention" Fixes)
    // =========================================================================

    // CRITICAL FIX: Fetch Polyfill
    // The Issue: JSDOM does not implement the Fetch API by default.
    // uu5loader uses 'fetch' to download libraries. Without this, the app hangs.
    //
    // The Fix: We expose Node's native fetch implementation to the JSDOM window.
    dom.window.fetch = global.fetch;
    dom.window.Headers = global.Headers;
    dom.window.Request = global.Request;
    dom.window.Response = global.Response;

    // Mock: Animation Frame
    // React uses this for rendering. If missing, the app freezes.
    global.requestAnimationFrame = (callback) => setTimeout(callback, 0);
    global.cancelAnimationFrame = (id) => clearTimeout(id);
    global.window.requestAnimationFrame = global.requestAnimationFrame;
    global.window.cancelAnimationFrame = global.cancelAnimationFrame;

    // Mock: Scroll (JSDOM has no visual viewport)
    global.window.scrollTo = () => {};

    // Mock: matchMedia
    // uu5 checks this to determine if it is on mobile or desktop.
    // If missing, it throws "TypeError: window.matchMedia is not a function".
    global.window.matchMedia =
      global.window.matchMedia ||
      function () {
        return { matches: false, addListener: () => {}, removeListener: () => {} };
      };

    // Mock: Canvas
    // uu5 checks for canvas support during initialization.
    global.HTMLCanvasElement = dom.window.HTMLCanvasElement;
    if (global.HTMLCanvasElement && !global.HTMLCanvasElement.prototype.getContext) {
      global.HTMLCanvasElement.prototype.getContext = () => null;
    }

    // Mock: IntersectionObserver
    // Used for lazy-loading components.
    global.IntersectionObserver =
      dom.window.IntersectionObserver ||
      class IntersectionObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      };

    // =========================================================================
    // STEP 4: RACE CONDITION SHIM (The "Loader" Fix)
    // =========================================================================
    // The Issue: JSDOM executes scripts synchronously. It runs the inline script in
    // index.html ("if (!window.Uu5Loader)...") immediately, BEFORE the external
    // uu5loader script has finished downloading. This causes "Uu5Loader failed to load".
    //
    // The Fix: We inject a "Mock Loader" immediately. This mock captures the app's
    // initialization requests (initUuApp, import) and holds them in a queue.
    // It polls for the *Real* loader every 50ms and replays the requests once it arrives.

    const mockQueue = { initData: null };

    const mockLoader = {
      // Capture the configuration call from <head>
      initUuApp: function (...args) {
        console.log("[MockLoader] Captured initUuApp configuration.");
        mockQueue.initData = args;
      },

      // Capture the boot call from <body>
      import: function (url) {
        console.log(`[MockLoader] Intercepted import('${url}'). Waiting for real loader...`);

        return new Promise((resolve, reject) => {
          // Poll every 50ms to see if the Real Loader has overwritten this mock
          const checker = setInterval(() => {
            const currentLoader = dom.window.Uu5Loader;

            // If the loader on the window is DIFFERENT from this mock, the real one loaded!
            if (currentLoader && currentLoader !== mockLoader) {
              console.log("[MockLoader] Real Uu5Loader arrived! Replaying sequence...");
              clearInterval(checker);

              try {
                // A. Replay Configuration
                if (mockQueue.initData && typeof currentLoader.initUuApp === "function") {
                  currentLoader.initUuApp(...mockQueue.initData);
                }

                // B. Replay Import
                currentLoader.import(url).then(resolve).catch(reject);
              } catch (err) {
                reject(err);
              }
            }
          }, 50);

          // Safety Timeout (15 seconds) - prevent infinite hanging if network fails
          setTimeout(() => {
            clearInterval(checker);
          }, 15000);
        });
      },

      // Mock helper to prevent crashes if error handler runs
      refreshCache: () => Promise.resolve(),

      // CRITICAL FIX: React Hot Loader Compatibility
      // react-refresh-runtime checks for .get(). Without this, it throws
      // "TypeError: Uu5Loader.get is not a function".
      get: () => null,
    };

    // Inject the Mock immediately so the check in index.html passes
    dom.window.Uu5Loader = mockLoader;

    return dom;
  }
}

module.exports = JsdomInitializer;
