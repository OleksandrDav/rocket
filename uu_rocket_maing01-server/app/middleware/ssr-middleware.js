"use strict";
const path = require("path");
const JsdomInitializer = require("../ssr/JsdomInitializer.js");

// Middleware Order: -101
// This runs BEFORE 'ServeStatic' (-100).
// This allows us to intercept the request for 'index.html' and generate it dynamically,
// while letting static files (images, JS) fall through to the standard file server.
const MIDDLEWARE_ORDER = -101;

class SsrMiddleware {
  constructor() {
    this.order = MIDDLEWARE_ORDER;
  }

  /**
   * Main Middleware Handler.
   * Executed for every request hitting the server.
   */
  async pre(req, res, next) {
    // 1. Method check: Only GET requests return HTML.
    if (req.method !== "GET") {
      return next();
    }

    // 2. Safety Shield: Skip paths that are definitely NOT the application UI.
    // - /oidc/: Auth callbacks
    // - /sys/: System commands
    // - /api/: Data endpoints
    if (
      req.url.includes("/oidc/") ||
      req.url.includes("/sys/") ||
      req.url.includes("/api/") ||
      req.url.includes("/rocket/")
    ) {
      return next();
    }

    // 3. Static File Filter: Skip files with extensions.
    // We only want to handle the "Root" or "Route" URLs (e.g., /home, /about).
    if (req.url.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|json|woff|woff2|ttf|map)$/)) {
      return next();
    }

    // 4. Header Check: Ensure the client actually wants HTML.
    // Browsers send "Accept: text/html". APIs usually send "application/json".
    if (!req.headers.accept || !req.headers.accept.includes("text/html")) {
      return next();
    }

    console.log(`[SSR-Middleware] Intercepting HTML request: ${req.url}`);

    try {
      const publicPath = path.join(process.cwd(), "public");

      // 5. URL Normalization (CRITICAL FIX)
      // `req.url` might be modified by internal rewrites (e.g., to "/defaultUve").
      // We must use `req.originalUrl` to ensure JSDOM sees the real path (e.g., "/home").
      // If we don't do this, React Router will render a 404 Not Found.
      const requestPath = req.originalUrl || req.url;

      const protocol = req.protocol || "http";
      const host = req.headers.host || "localhost";
      const fullUrl = `${protocol}://${host}${requestPath}`;

      // 6. Initialize JSDOM
      // Create the virtual browser at the specific URL the user requested.
      const initializer = new JsdomInitializer(publicPath, "index.html", {
        url: fullUrl,
      });

      const dom = await initializer.run();
      const window = dom.window;

      // 7. Wait for Rendering
      // JSDOM loads almost instantly, but React needs time to fetch data and render DOM nodes.
      // We pause here until the app is "Ready".
      await this._waitForAppRender(window);

      // --- NEW: INJECT HYDRATION DATA ---
      // 1. Check if the app saved any data during render
      const ssrData = window.__SSR_DATA__;

      // 2. If data exists, inject it into the HTML head/body
      if (ssrData) {
        const script = window.document.createElement("script");
        // Serialize the data to a string
        script.textContent = `window.__SSR_DATA__ = ${JSON.stringify(ssrData)};`;
        // Append to body so it executes before React hydrates
        window.document.body.appendChild(script);
      }

      // 8. Serialize
      // Convert the live DOM (with React content) back into a string string.
      const html = dom.serialize();

      // 9. Send Response
      // Return the fully rendered HTML to the browser.
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.writeHead(200);
      res.write(html);
      res.end();

      // 10. Cleanup
      // Free up memory by closing the virtual window.
      window.close();
    } catch (error) {
      // 11. Error Handling (Fallback)
      // If ANYTHING goes wrong (timeout, crash, error), we log it and call next().
      // This passes control to 'ServeStatic', which sends the blank index.html.
      // This ensures the site never crashes completely; it just falls back to Client-Side Rendering.
      console.error(`[SSR-Middleware] Failed to render ${req.url}. Fallback to static.`, error.message);
      return next();
    }
  }

  /**
   * Helper: _waitForAppRender
   * Polls the JSDOM document to determine when React has finished rendering.
   */
  _waitForAppRender(window) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const timeout = 10000; // 10 seconds timeout for data fetching

      const interval = setInterval(() => {
        const appDiv = window.document.getElementById("uuApp");
        const loadingDiv = window.document.getElementById("uuAppLoading");

        // 1. Error Screen Check
        if (
          appDiv &&
          appDiv.innerHTML.includes("uu-app-script-error-description") &&
          !appDiv.innerHTML.includes("hidden")
        ) {
          clearInterval(interval);
          reject(new Error("JSDOM rendered the 'uu-app-script-error' screen. Check logs."));
          return;
        }

        // 2. SUCCESS CHECK (Updated)
        // We wait until the App Signal (__SSR_REQ_COMPLETE__) is true.
        // If the signal is never sent (e.g. no data fetching needed), we fallback to basic content check after 2 seconds.
        const isDataReady = window.__SSR_REQ_COMPLETE__ === true;
        const hasContent = appDiv && appDiv.children.length > 0 && !loadingDiv;

        // Strategy: Wait for explicit signal OR fallback if content exists and time passed
        if (isDataReady) {
          clearInterval(interval);
          resolve();
          return;
        }

        // Fallback: If 2 seconds passed and we have content but no signal, assume no fetch was needed
        if (hasContent && Date.now() - start > 2000) {
          clearInterval(interval);
          resolve();
          return;
        }

        // 3. Timeout Check
        if (Date.now() - start > timeout) {
          clearInterval(interval);
          console.warn("[SSR] Timeout waiting for data. Sending what we have.");
          resolve(); // Resolve anyway to send the Loading state instead of crashing
        }
      }, 100);
    });
  }
}

module.exports = SsrMiddleware;
