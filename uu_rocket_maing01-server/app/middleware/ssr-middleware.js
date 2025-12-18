"use strict";
const path = require("path");
const fs = require("fs");
const JsdomInitializer = require("../ssr/JsdomInitializer.js");
const routeRegistry = require("../ssr/route-registry.js"); // <--- NEW IMPORT

// Middleware Order: -101
const MIDDLEWARE_ORDER = -101;

class SsrMiddleware {
  constructor() {
    this.order = MIDDLEWARE_ORDER;
  }

  async pre(req, res, next) {
    // 1. Basic Checks (Method, Paths, Static Files)
    if (req.method !== "GET") return next();

    if (
      req.url.includes("/oidc/") ||
      req.url.includes("/sys/") ||
      req.url.includes("/api/") ||
      req.url.includes("/rocket/")
    ) {
      return next();
    }

    if (req.url.endsWith(".map")) {
      res.setHeader("Content-Type", "application/json");
      res.writeHead(200);
      res.write("{}");
      res.end();
      return;
    }

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
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".json": "application/json",
          }[ext] || "application/octet-stream";

        res.setHeader("Content-Type", mime);
        res.setHeader("Cache-Control", "public, max-age=3600");
        fs.createReadStream(filePath).pipe(res);
        return;
      }
    }

    if (req.url.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|json|woff|woff2|ttf|map)$/)) {
      return next();
    }

    if (!req.headers.accept || !req.headers.accept.includes("text/html")) {
      return next();
    }

    console.log(`[SSR-Middleware] Intercepting HTML request: ${req.url}`);

    try {
      // 2. URL Normalization
      const requestPath = req.originalUrl || req.url;
      const protocol = req.protocol || "http";
      const host = req.headers.host || "localhost";
      const fullUrl = `${protocol}://${host}${requestPath}`;

      // =======================================================================
      // 🟢 MILESTONE 2: SERVER-SIDE DATA PRE-FETCH
      // =======================================================================
      let preFetchedData = null;

      // Look up the route in our registry
      const loader = routeRegistry[requestPath];

      if (loader) {
        console.log(`[SSR] 📥 Found matching route. Starting Pre-fetch...`);
        try {
          // EXECUTE THE LOADER (Runs in Node.js)
          preFetchedData = await loader();
          console.log(`[SSR] ✅ Data Pre-fetch Successful! (${JSON.stringify(preFetchedData).length} bytes)`);
        } catch (e) {
          console.error(`[SSR] ⚠️ Data Pre-fetch Failed: ${e.message}`);
          // We continue! If server fetch fails, we let the client try later.
        }
      } else {
        console.log(`[SSR] ℹ️ No server loader defined for this route.`);
      }
      // =======================================================================

      // 3. Initialize JSDOM
      const publicPath = path.join(process.cwd(), "public");
      const initializer = new JsdomInitializer(publicPath, "index.html", {
        url: fullUrl,
      });

      const dom = await initializer.run();
      const window = dom.window;

      // ===================================================================
      // 🟢 MILESTONE 3: INJECT DATA (The Handover)
      // ===================================================================
      if (preFetchedData) {
        console.log("[SSR] 💉 Injecting pre-fetched data into JSDOM window");

        // 1. Write to the JSDOM window object so React can see it NOW
        window.__INITIAL_DATA__ = preFetchedData;

        // 2. Write a <script> tag so the REAL BROWSER (Client) can see it later
        // This ensures that when the user takes over, they don't re-fetch either.
        const script = window.document.createElement("script");
        script.textContent = `window.__INITIAL_DATA__ = ${JSON.stringify(preFetchedData)};`;
        window.document.body.appendChild(script);
      }
      // ===================================================================

      // ===================================================================
      // 🟢 MILESTONE 4 FIX: WAIT FOR FRAMEWORK BOOT
      // ===================================================================
      // Even if data is ready, the uu5 framework takes a moment to initialize
      // and remove the default #uuAppLoading spinner.

      await new Promise((resolve) => {
        const start = Date.now();
        // We assume it should be very fast (< 2 seconds)
        const timeout = 2000;

        const interval = setInterval(() => {
          const loadingElement = window.document.getElementById("uuAppLoading");

          // 1. SUCCESS: Spinner is gone! The App is visible.
          if (!loadingElement) {
            clearInterval(interval);
            console.log(`[SSR] ✨ Framework booted in ${Date.now() - start}ms`);
            resolve();
            return;
          }

          // 2. TIMEOUT: It's taking too long (maybe auth stuck?)
          // We resolve anyway to send whatever we have.
          if (Date.now() - start > timeout) {
            clearInterval(interval);
            console.warn("[SSR] ⚠️ Timeout waiting for framework boot (uuAppLoading still present).");
            resolve();
          }
        }, 50); // Check every 50ms
      });
      // ===================================================================

      // 5. Serialize
      // (Injection will happen here in Milestone 3)
      const html = dom.serialize();

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.writeHead(200);
      res.write(html);
      res.end();
      window.close();
    } catch (error) {
      console.error(`[SSR-Middleware] Failed to render ${req.url}. Fallback to static.`, error.message);
      return next();
    }
  }
}

module.exports = SsrMiddleware;
