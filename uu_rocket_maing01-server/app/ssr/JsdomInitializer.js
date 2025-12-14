const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const fs = require("fs");
const path = require("path");

class JsdomInitializer {
  /**
   * @param {string} frontDistPath - Path to the folder containing your built client (e.g., /public/uu5-client)
   * @param {string} frontDistIndexFileName - Usually 'index.html'
   * @param {object} reconfigureSettings - Optional JSDOM settings (like URL)
   */
  constructor(frontDistPath, frontDistIndexFileName = "index.html", reconfigureSettings = {}) {
    this.frontDistPath = frontDistPath;
    this.frontDistIndexFileName = frontDistIndexFileName;
    this.reconfigureSettings = reconfigureSettings;
  }

  async run() {
    const fullPath = path.join(this.frontDistPath, this.frontDistIndexFileName);
    console.log(`[SSR] Initializing JSDOM from: ${fullPath}`);

    // FIX 1: Merge default options with your custom settings IMMEDIATELY.
    // This applies the "file://" URL *before* JSDOM starts, preventing base-path bugs.
    const options = {
      runScripts: "dangerously",
      resources: "usable",
      pretendToBeVisual: true,
      url: "http://localhost:8080/", // Default fallback
      ...this.reconfigureSettings, // <--- OVERRIDES DEFAULTS HERE
    };

    // Create JSDOM with the merged options
    const dom = await JSDOM.fromFile(fullPath, options);

    // ---------------------------------------------------------
    // FIX 2: Global Scope Pollution & Mocks
    // ---------------------------------------------------------
    global.window = dom.window;
    global.document = dom.window.document;

    // FIX 3: Navigator Fix for Node v22+ (Read-only property bypass)
    Object.defineProperty(global, "navigator", {
      value: dom.window.navigator,
      writable: true,
      configurable: true,
    });

    global.history = dom.window.history;
    global.location = dom.window.location;

    // Core DOM Constructors
    global.HTMLElement = dom.window.HTMLElement;
    global.Element = dom.window.Element;
    global.Node = dom.window.Node;
    global.NodeFilter = dom.window.NodeFilter;
    global.DocumentFragment = dom.window.DocumentFragment;
    global.Event = dom.window.Event;
    global.CustomEvent = dom.window.CustomEvent;

    // Mocks: RequestAnimationFrame
    global.requestAnimationFrame = (callback) => setTimeout(callback, 0);
    global.cancelAnimationFrame = (id) => clearTimeout(id);
    global.window.requestAnimationFrame = global.requestAnimationFrame;
    global.window.cancelAnimationFrame = global.cancelAnimationFrame;

    // Mocks: Scroll
    global.window.scrollTo = () => {};

    // Mocks: MatchMedia (Critical for uu5 responsiveness)
    global.window.matchMedia =
      global.window.matchMedia ||
      function () {
        return { matches: false, addListener: () => {}, removeListener: () => {} };
      };

    // Mocks: Canvas
    global.HTMLCanvasElement = dom.window.HTMLCanvasElement;
    if (global.HTMLCanvasElement && !global.HTMLCanvasElement.prototype.getContext) {
      global.HTMLCanvasElement.prototype.getContext = () => null;
    }

    // Mocks: IntersectionObserver (Critical for lazy loading)
    global.IntersectionObserver =
      dom.window.IntersectionObserver ||
      class IntersectionObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      };

    // ---------------------------------------------------------
    // FIX 4: Uu5Loader Race Condition Shim
    // ---------------------------------------------------------
    // The HTML checks for "window.Uu5Loader" immediately, but JSDOM is still downloading the script.
    // We create a temporary "Mock Loader" to catch the calls and replay them when the real loader arrives.

    const mockQueue = { initData: null };
    const mockLoader = {
      // Capture configuration from <head>
      initUuApp: function (...args) {
        console.log("[MockLoader] Captured initUuApp configuration.");
        mockQueue.initData = args;
      },
      // Capture boot call from <body>
      import: function (url) {
        console.log(`[MockLoader] Intercepted import('${url}'). Waiting for real loader...`);

        return new Promise((resolve, reject) => {
          // Poll every 50ms to see if the Real Loader has arrived
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

          // Safety Timeout (15 seconds)
          setTimeout(() => {
            clearInterval(checker);
            console.warn("[MockLoader] Timed out waiting for real Uu5Loader.");
          }, 15000);
        });
      },
      refreshCache: () => Promise.resolve(),
    };

    // Inject the Mock immediately so the "if (!window.Uu5Loader)" check passes
    dom.window.Uu5Loader = mockLoader;

    return dom;
  }
}

module.exports = JsdomInitializer;
