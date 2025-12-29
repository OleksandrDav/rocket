const routeRegistry = require("../../app/ssr/route-registry.js");

// Check if Node environment supports fetch (Node 18+)
if (!global.fetch) {
  console.error("⚠️ Error: global.fetch is not defined. Please use Node.js v18 or newer.");
  process.exit(1);
}

// The URL we want to test
const TEST_URL = "/uu-rocket-maing01/22222222222222222222222222222222/home";

async function runTest() {
  console.log("==========================================");
  console.log("🛠️  SSR DATA LOADER TEST");
  console.log("==========================================");
  console.log(`Target Route: ${TEST_URL}`);

  const loader = routeRegistry[TEST_URL];

  if (!loader) {
    console.error("❌ FAILED: Route not found in registry.");
    console.log("Available keys:", Object.keys(routeRegistry));
    return;
  }

  console.log("✅ Route found. Executing loader...");

  try {
    const start = Date.now();
    const result = await loader();
    const duration = Date.now() - start;

    console.log(`\n✅ SUCCESS! Data fetched in ${duration}ms`);
    console.log("------------------------------------------");

    // Preview the data to confirm it's correct
    const jsonStr = JSON.stringify(result, null, 2);
    console.log("Data Preview:", jsonStr.substring(0, 300) + (jsonStr.length > 300 ? "..." : ""));

    console.log("------------------------------------------");

    // Verification check
    if (result.rocketList && result.rocketList.itemList) {
      console.log(`✅ Structure Valid: Found ${result.rocketList.itemList.length} items in rocketList.`);
    } else {
      console.warn("⚠️ Structure Warning: 'rocketList' key missing or empty.");
    }
  } catch (error) {
    console.error("\n❌ FAILED: Loader threw an error.");
    console.error(error);
  }
}

runTest();
