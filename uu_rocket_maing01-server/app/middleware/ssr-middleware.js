"use strict";

const path = require("path");
const fs = require("fs");
const JsdomPool = require("../ssr/JsdomPool.js");
const routeRegistry = require("../ssr/route-registry.js");

// Configure the JSDOM instance pool.
// Initialization is deferred to the first request to ensure the host server
// is fully operational and the port is bound before environment setup.
const ssrPool = new JsdomPool({
  frontDistPath: path.join(process.cwd(), "public"),
  indexHtml: "index.html",
  minInstances: 2,
  maxUses: 50,
});

const MIDDLEWARE_ORDER = -101;

/**
 * SsrMiddleware
 * -------------
 * Manages the Server-Side Rendering lifecycle by intercepting HTML requests
 * and utilizing a pre-initialized pool of JSDOM environments.
 */
class SsrMiddleware {
  constructor() {
    this.order = MIDDLEWARE_ORDER;
  }

  async pre(req, res, next) {
    // -------------------------------------------------------------------------
    // STEP 1: REQUEST FILTERING
    // -------------------------------------------------------------------------

    // Ignore source maps and non-GET requests
    if (req.url.endsWith(".map")) {
      res.statusCode = 404;
      res.end();
      return;
    }
    if (req.method !== "GET") return next();

    // Exclude static assets and binary files from SSR processing
    if (req.url.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|json|woff|woff2|ttf|map)$/)) {
      return next();
    }

    // Bypass SSR for API, OIDC, and system-level endpoints
    if (
      req.url.includes("/oidc/") ||
      req.url.includes("/sys/") ||
      req.url.includes("/api/") ||
      req.url.includes("/rocket/")
    ) {
      return next();
    }

    // -------------------------------------------------------------------------
    // STEP 2: INTERNAL RESOURCE RESOLUTION
    // -------------------------------------------------------------------------
    // Resolve static assets requested by JSDOM instances that may not be
    // accessible via standard routing during the internal rendering cycle.
    if (req.url.includes("/public/")) {
      const cleanUrl = req.url.split("?")[0];
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

    // Verify the request explicitly accepts HTML content
    if (!req.headers.accept || !req.headers.accept.includes("text/html")) {
      return next();
    }

    try {
      // -----------------------------------------------------------------------
      // STEP 3: DEFERRED POOL INITIALIZATION
      // -----------------------------------------------------------------------
      // Ensures the application pool is warmed up only after the server is active.
      if (!ssrPool.isInitialized) {
        console.log("[SSR] Initial request detected. Initializing resource pool...");
        await ssrPool.init();
      }

      // -----------------------------------------------------------------------
      // STEP 4: SERVER-SIDE DATA PRE-FETCHING
      // -----------------------------------------------------------------------
      // Execute data loaders defined in the Route Registry for the requested path.
      const requestPath = req.originalUrl || req.url;
      let preFetchedData = null;
      const loader = routeRegistry[requestPath];

      if (loader) {
        try {
          preFetchedData = await loader();
          console.log(`[SSR] Data successfully pre-fetched for ${requestPath}`);
        } catch (e) {
          console.error(`[SSR] Data pre-fetch error: ${e.message}`);
        }
      }

      // -----------------------------------------------------------------------
      // STEP 5: RESOURCE ACQUISITION
      // -----------------------------------------------------------------------
      // Retrieve an idle JSDOM environment from the pool.
      const dom = await ssrPool.acquire();
      const window = dom.window;

      // -----------------------------------------------------------------------
      // STEP 6: STATE INJECTION & HYDRATION PREPARATION
      // -----------------------------------------------------------------------
      // 1. Synchronize the pre-fetched state with the running JSDOM instance.
      window.__INITIAL_DATA__ = preFetchedData;

      // 2. Append the state to the document for client-side hydration.
      let dataScript = window.document.getElementById("ssr-data-script");
      if (!dataScript) {
        dataScript = window.document.createElement("script");
        dataScript.id = "ssr-data-script";
        window.document.body.appendChild(dataScript);
      }
      dataScript.textContent = `window.__INITIAL_DATA__ = ${preFetchedData ? JSON.stringify(preFetchedData) : "null"};`;

      // -----------------------------------------------------------------------
      // STEP 7: ENVIRONMENT ROUTE SYNCHRONIZATION
      // -----------------------------------------------------------------------
      // Navigate the existing JSDOM environment to the requested application route.
      const routeName = this._extractRouteName(requestPath);

      if (window.__SSR_SET_ROUTE__) {
        // Yield to the event loop to allow React to process the state transition.
        await new Promise((r) => setTimeout(r, 0));
        window.__SSR_SET_ROUTE__(routeName);
      }

      // -----------------------------------------------------------------------
      // STEP 8: STABILITY MONITORING & SERIALIZATION
      // -----------------------------------------------------------------------
      // Wait for the framework to finish rendering before capturing the HTML string.
      await this._waitForStability(window);

      const html = dom.serialize();

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.writeHead(200);
      res.write(html);
      res.end();

      // Return the JSDOM instance to the pool for reuse.
      ssrPool.release(dom);
    } catch (error) {
      console.error(`[SSR] Rendering pipeline failed:`, error);
      // Fallback to client-side rendering on pipeline failure.
      return next();
    }
  }

  /**
   * Maps the request URL path to the corresponding application route name.
   */
  _extractRouteName(fullPath) {
    const parts = fullPath.split("/");
    const segments = parts.filter((p) => p);
    const last = segments[segments.length - 1];
    if (["home", "contact"].includes(last)) return last;
    return "home";
  }

  /**
   * Polls the JSDOM document until the framework's loading indicator is removed,
   * signaling that the UI is stable and ready for serialization.
   */
  _waitForStability(window) {
    return new Promise((resolve) => {
      // Immediate resolution if the environment is already stable.
      if (!window.document.getElementById("uuAppLoading")) {
        setTimeout(resolve, 50);
        return;
      }

      const start = Date.now();
      const interval = setInterval(() => {
        if (!window.document.getElementById("uuAppLoading")) {
          clearInterval(interval);
          resolve();
        }
        // Safety timeout to prevent request hanging.
        if (Date.now() - start > 2000) {
          clearInterval(interval);
          resolve();
        }
      }, 50);
    });
  }
}

module.exports = SsrMiddleware;
