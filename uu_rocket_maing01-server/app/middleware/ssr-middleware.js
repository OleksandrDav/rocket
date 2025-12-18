"use strict";
const path = require("path");
const fs = require("fs");
const JsdomPool = require("../ssr/JsdomPool.js");
const routeRegistry = require("../ssr/route-registry.js");

// Initialize Pool configuration (DO NOT call .init() here)
const ssrPool = new JsdomPool({
  frontDistPath: path.join(process.cwd(), "public"),
  indexHtml: "index.html",
  minInstances: 2,
  maxUses: 50,
});

const MIDDLEWARE_ORDER = -101;

class SsrMiddleware {
  constructor() {
    this.order = MIDDLEWARE_ORDER;
  }

  async pre(req, res, next) {
    if (req.url.endsWith(".map")) {
      res.statusCode = 404;
      res.end();
      return;
    }
    // 1. Basic Checks
    if (req.method !== "GET") return next();
    if (req.url.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|json|woff|woff2|ttf|map)$/)) return next();
    if (
      req.url.includes("/oidc/") ||
      req.url.includes("/sys/") ||
      req.url.includes("/api/") ||
      req.url.includes("/rocket/")
    )
      return next();

    // 2. STATIC FILE FIX (CRITICAL FOR JSDOM)
    // You must include this block so JSDOM can find local scripts/css
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

    if (!req.headers.accept || !req.headers.accept.includes("text/html")) return next();

    try {
      // ===================================================================
      // 🟢 CHANGE 1: LAZY INIT (Fixes the Startup Crash)
      // ===================================================================
      // We start the pool here, on the first user request.
      // This ensures the server is fully running (Port 8080 open) before JSDOM tries to connect.
      if (!ssrPool.isInitialized) {
        console.log("[SSR] First request detected. Warming up pool...");
        await ssrPool.init();
      }
      // ===================================================================

      // 3. PRE-FETCH DATA
      const requestPath = req.originalUrl || req.url;
      let preFetchedData = null;
      const loader = routeRegistry[requestPath];

      if (loader) {
        try {
          preFetchedData = await loader();
          console.log(`[SSR] 📥 Pre-fetched data for ${requestPath}`);
        } catch (e) {
          console.error(`[SSR] ⚠️ Pre-fetch failed: ${e.message}`);
        }
      }

      // 4. ACQUIRE INSTANCE
      const dom = await ssrPool.acquire();
      const window = dom.window;

      // 5. HOT SWAP: Inject Data
      window.__INITIAL_DATA__ = preFetchedData;

      let dataScript = window.document.getElementById("ssr-data-script");
      if (!dataScript) {
        dataScript = window.document.createElement("script");
        dataScript.id = "ssr-data-script";
        window.document.body.appendChild(dataScript);
      }
      dataScript.textContent = `window.__INITIAL_DATA__ = ${preFetchedData ? JSON.stringify(preFetchedData) : "null"};`;

      // 6. HOT SWAP: Teleport Route
      const routeName = this._extractRouteName(requestPath);

      if (window.__SSR_SET_ROUTE__) {
        await new Promise((r) => setTimeout(r, 0));
        window.__SSR_SET_ROUTE__(routeName);
      }

      // 7. WAIT FOR STABILITY
      await this._waitForStability(window);

      // 8. SERIALIZE & SEND
      const html = dom.serialize();

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.writeHead(200);
      res.write(html);
      res.end();

      // 9. RELEASE INSTANCE
      ssrPool.release(dom);
    } catch (error) {
      console.error(`[SSR] Error:`, error);
      // Even if error, try to release the instance if we grabbed one
      // (Advanced: you might want to track 'dom' variable scope to ensure release)
      return next();
    }
  }

  _extractRouteName(fullPath) {
    const parts = fullPath.split("/");
    const segments = parts.filter((p) => p);
    const last = segments[segments.length - 1];
    if (["home", "contact"].includes(last)) return last;
    return "home";
  }

  _waitForStability(window) {
    return new Promise((resolve) => {
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
        if (Date.now() - start > 2000) {
          clearInterval(interval);
          resolve();
        }
      }, 50);
    });
  }
}

module.exports = SsrMiddleware;
