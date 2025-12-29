const path = require("path");
const JsdomPool = require("../../app/ssr/JsdomPool.js");

async function runTest() {
  console.log("--- Starting Pool Test ---");

  // 1. Initialize Pool
  const publicPath = path.join(process.cwd(), "public");
  const pool = new JsdomPool({
    frontDistPath: publicPath,
    indexHtml: "index.html",
    minInstances: 2, // Keep 2 browsers open
    maxUses: 3, // Kill browser after 3 uses (Low number for testing)
  });

  await pool.init();

  // 2. Simulate High Traffic (10 Requests)
  console.log("\n--- Simulating 10 Requests ---");
  for (let i = 1; i <= 10; i++) {
    console.log(`\nRequest #${i}: Asking for browser...`);
    const start = Date.now();

    // Acquire
    const dom = await pool.acquire();
    const id = dom._poolMeta.id;
    const uses = dom._poolMeta.usageCount;

    console.log(`   -> Got Instance [${id}] (Use #${uses}) in ${Date.now() - start}ms`);

    // Simulate work (Rendering)
    await new Promise((r) => setTimeout(r, 100)); // Pretend rendering takes 100ms

    // Release
    await pool.release(dom);
  }

  console.log("\n✅ Test Complete. Pool handled traffic.");
  process.exit(0);
}

runTest();
