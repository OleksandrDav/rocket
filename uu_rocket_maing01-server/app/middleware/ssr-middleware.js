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
    if (req.url.includes("/oidc/") || req.url.includes("/sys/") || req.url.includes("/api/")) {
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
      const timeout = 30000; // 30 seconds max wait time

      const interval = setInterval(() => {
        const appDiv = window.document.getElementById("uuApp");
        const loadingDiv = window.document.getElementById("uuAppLoading");

        // Check for "Script Error" screen
        // If the app crashed inside JSDOM, it often renders a specific error div.
        if (
          appDiv &&
          appDiv.innerHTML.includes("uu-app-script-error-description") &&
          !appDiv.innerHTML.includes("hidden")
        ) {
          clearInterval(interval);
          reject(new Error("JSDOM rendered the 'uu-app-script-error' screen. Check logs for Polyfill errors."));
          return;
        }

        // Check for SUCCESS
        // We are done if:
        // 1. The #uuApp div has children (React put content there).
        // 2. The #uuAppLoading spinner is gone (React removed it).
        if (appDiv && appDiv.children.length > 0 && !loadingDiv) {
          clearInterval(interval);
          resolve(); // Render complete!
          return;
        }

        // Check for Timeout
        if (Date.now() - start > timeout) {
          clearInterval(interval);
          reject(new Error("Timeout waiting for React to remove #uuAppLoading"));
        }
      }, 100); // Check every 100ms
    });
  }
}

module.exports = SsrMiddleware;
