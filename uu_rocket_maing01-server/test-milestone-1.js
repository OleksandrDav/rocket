const JsdomInitializer = require("./app/ssr/JsdomInitializer");
const path = require("path");
const fs = require("fs");

(async () => {
  // 1. Point to the public folder
  const publicPath = path.resolve(__dirname, "./public");

  if (!fs.existsSync(path.join(publicPath, "index.html"))) {
    console.error(`❌ ERROR: Could not find index.html at ${publicPath}`);
    process.exit(1);
  }

  // 2. Configure JSDOM for FILE MODE
  // We use "file://" so JSDOM loads scripts directly from disk without a server.
  const settings = {
    url: "file://" + path.join(publicPath, "index.html"),
    runScripts: "dangerously",
    resources: "usable",
  };

  const initializer = new JsdomInitializer(publicPath, "index.html", settings);

  console.log("🚀 Starting JSDOM Simulation...");
  try {
    const dom = await initializer.run();
    const win = dom.window;

    // FIX: Mock matchMedia (Critical for uu5)
    // We do this immediately after creating the window
    win.matchMedia =
      win.matchMedia ||
      function () {
        return {
          matches: false,
          addListener: function () {},
          removeListener: function () {},
        };
      };

    console.log(`✅ JSDOM Started. Location: ${win.location.href}`);
    console.log("⏳ Waiting for Uu5Loader...");

    const interval = setInterval(() => {
      const appDiv = win.document.getElementById("uuApp");

      // Success: Content exists AND it is not the error screen
      if (appDiv && appDiv.children.length > 0) {
        // Check if we accidentally rendered the error screen
        if (appDiv.innerHTML.includes("uu-app-script-error")) {
          console.log("⚠️ Content detected, but it looks like an error screen.");
          // We don't stop here; we let it keep running or print the error content
          console.log(appDiv.innerHTML.substring(0, 200));
          clearInterval(interval);
          win.close();
          process.exit(1);
        } else {
          console.log("\n🎉 SUCCESS! App Rendered!");
          console.log(dom.serialize().substring(0, 500) + " ... [truncated]");
          clearInterval(interval);
          win.close();
          process.exit(0);
        }
      }
    }, 500);

    setTimeout(() => {
      console.error("\n❌ TIMEOUT: App did not render in 10 seconds.");
      win.close();
      process.exit(1);
    }, 10000);
  } catch (e) {
    console.error("❌ CRASH during JSDOM initialization:", e);
  }
})();
