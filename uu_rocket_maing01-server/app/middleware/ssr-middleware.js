"use strict";
const path = require("path");
const fs = require("fs");
const JsdomPool = require("../ssr/JsdomPool.js");
const routeRegistry = require("../ssr/route-registry.js");

// Initialize Pool configuration.
// NOTE: We do NOT call .init() here to avoid race conditions during server startup.
// We use "Lazy Initialization" inside the middleware instead.
const ssrPool = new JsdomPool({
  frontDistPath: path.join(process.cwd(), "public"),
  indexHtml: "index.html",
  minInstances: 2, // Keep 2 "Zombie Browsers" ready
  maxUses: 50, // Recycle browser after 50 uses to prevent memory leaks
});

const MIDDLEWARE_ORDER = -101;

/**
 * Class: SsrMiddleware
 * --------------------
 * Intercepts incoming HTML requests and performs Server-Side Rendering (SSR)
 * using a pool of pre-warmed JSDOM instances ("Zombie Browsers").
 */
class SsrMiddleware {
  constructor() {
    this.order = MIDDLEWARE_ORDER;
  }

  async pre(req, res, next) {
    // -------------------------------------------------------------------------
    // STEP 1: FILTERS & CHECKS
    // -------------------------------------------------------------------------

    // Ignore source maps (prevents 404 logs)
    if (req.url.endsWith(".map")) {
      res.statusCode = 404;
      res.end();
      return;
    }

    // Ignore non-GET requests
    if (req.method !== "GET") return next();

    // Ignore static assets (images, fonts, etc.)
    if (req.url.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|json|woff|woff2|ttf|map)$/)) {
      return next();
    }

    // Ignore API, System, and OIDC endpoints
    if (
      req.url.includes("/oidc/") ||
      req.url.includes("/sys/") ||
      req.url.includes("/api/") ||
      req.url.includes("/rocket/")
    ) {
      return next();
    }

    // -------------------------------------------------------------------------
    // STEP 2: STATIC FILE FIX (Critical for JSDOM)
    // -------------------------------------------------------------------------
    // JSDOM tries to fetch scripts like `/public/0.1.0/index.js`.
    // Since the server might not serve these correctly during internal requests,
    // we intercept them and serve the files directly from the disk.
    if (req.url.includes("/public/")) {
      const cleanUrl = req.url.split("?")[0];
      // Extract the filename, ignoring version segments (e.g., /0.1.0/)
      const parts = cleanUrl.split("/public/");
      const relativePathWithVersion = parts.length > 1 ? parts.pop() : parts[0];
      const filename = path.basename(relativePathWithVersion);
      const filePath = path.join(process.cwd(), "public", filename);

      if (fs.existsSync(filePath)) {
        const ext = path.extname(filePath).toLowerCase();
        const mime =
          {
            ".js": "application/javascript",
            ".css": "text/css",
            ".json": "application/json",
          }[ext] || "application/octet-stream";

        res.setHeader("Content-Type", mime);
        res.setHeader("Cache-Control", "public, max-age=3600");
        fs.createReadStream(filePath).pipe(res);
        return;
      }
    }

    // Only handle requests asking for HTML
    if (!req.headers.accept || !req.headers.accept.includes("text/html")) {
      return next();
    }

    try {
      // -----------------------------------------------------------------------
      // STEP 3: LAZY INITIALIZATION (Fixes Startup Crash)
      // -----------------------------------------------------------------------
      // We wait for the first real user request to start the pool.
      // This guarantees the HTTP server is fully listening on port 8080.
      if (!ssrPool.isInitialized) {
        console.log("[SSR] First request detected. Warming up pool...");
        await ssrPool.init();
      }

      // -----------------------------------------------------------------------
      // STEP 4: PRE-FETCH DATA
      // -----------------------------------------------------------------------
      // Look up the URL in our Route Registry to see if we need data.
      const requestPath = req.originalUrl || req.url;
      let preFetchedData = null;
      const loader = routeRegistry[requestPath];

      if (loader) {
        try {
          preFetchedData = await loader();
          console.log(`[SSR] 📥 Pre-fetched data for ${requestPath}`);
        } catch (e) {
          console.error(`[SSR] ⚠️ Pre-fetch failed: ${e.message}`);
          // Continue rendering even if data fails (Client will retry)
        }
      }

      // -----------------------------------------------------------------------
      // STEP 5: ACQUIRE INSTANCE
      // -----------------------------------------------------------------------
      // Grab a "Zombie Browser" from the pool (Zero Latency)
      const dom = await ssrPool.acquire();
      const window = dom.window;

      // -----------------------------------------------------------------------
      // STEP 6: HOT SWAP - DATA INJECTION
      // -----------------------------------------------------------------------
      // 1. Inject into the running instance for React to see immediately
      window.__INITIAL_DATA__ = preFetchedData;

      // 2. Inject into the HTML for the Client Browser to see later
      let dataScript = window.document.getElementById("ssr-data-script");
      if (!dataScript) {
        dataScript = window.document.createElement("script");
        dataScript.id = "ssr-data-script";
        window.document.body.appendChild(dataScript);
      }
      dataScript.textContent = `window.__INITIAL_DATA__ = ${preFetchedData ? JSON.stringify(preFetchedData) : "null"};`;

      // -----------------------------------------------------------------------
      // STEP 7: HOT SWAP - TELEPORT ROUTE
      // -----------------------------------------------------------------------
      // Use the Bridge (RouteBar.js) to tell the app to switch pages.
      const routeName = this._extractRouteName(requestPath);

      if (window.__SSR_SET_ROUTE__) {
        // Tiny timeout ensures the React Event Loop is free to process the update
        await new Promise((r) => setTimeout(r, 0));
        window.__SSR_SET_ROUTE__(routeName);
      }

      // -----------------------------------------------------------------------
      // STEP 8: WAIT FOR STABILITY & SERIALIZE
      // -----------------------------------------------------------------------
      // Ensure the "Loading..." spinner is gone before capturing HTML.
      await this._waitForStability(window);

      const html = dom.serialize();

      // Send Response
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.writeHead(200);
      res.write(html);
      res.end();

      // Release the instance back to the pool
      ssrPool.release(dom);
    } catch (error) {
      console.error(`[SSR] Error:`, error);
      // Fallback to standard client-side rendering if SSR explodes
      return next();
    }
  }

  /**
   * Helper: Maps a URL path (e.g., /.../contact) to a Route Name (e.g., "contact")
   */
  _extractRouteName(fullPath) {
    const parts = fullPath.split("/");
    const segments = parts.filter((p) => p);
    const last = segments[segments.length - 1];
    if (["home", "contact"].includes(last)) return last;
    return "home";
  }

  /**
   * Helper: Waits for the #uuAppLoading spinner to disappear from the DOM.
   * This confirms the uu5 framework has finished initializing.
   */
  _waitForStability(window) {
    return new Promise((resolve) => {
      // Fast path: already stable
      if (!window.document.getElementById("uuAppLoading")) {
        setTimeout(resolve, 50); // Tiny buffer for React commit phase
        return;
      }

      // Slow path: poll until ready
      const start = Date.now();
      const interval = setInterval(() => {
        if (!window.document.getElementById("uuAppLoading")) {
          clearInterval(interval);
          resolve();
        }
        // Timeout after 2 seconds to avoid hanging requests forever
        if (Date.now() - start > 2000) {
          clearInterval(interval);
          resolve();
        }
      }, 50);
    });
  }
}

module.exports = SsrMiddleware;
