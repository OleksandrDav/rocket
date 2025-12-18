"use strict";

// Define your API Base URL
// This makes it easier to manage if the workspace ID changes
const WORKSPACE_URI = "/uu-rocket-maing01/22222222222222222222222222222222";
const API_BASE = `http://localhost:8080${WORKSPACE_URI}`;

module.exports = {
  // ---------------------------------------------------------------------------
  // ROUTE 1: HOME (Needs Rocket List)
  // ---------------------------------------------------------------------------
  // The key must match the req.originalUrl exactly
  [`${WORKSPACE_URI}/home`]: async () => {
    console.log("[RouteRegistry] 🚀 Fetching Rocket List data...");

    try {
      const response = await fetch(`${API_BASE}/rocket/list`, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`API returned status: ${response.status}`);
      }

      const data = await response.json();

      // CRITICAL: We structure the data exactly how useSsrFetch expects it.
      // Your component asks for key "rocketList", so we wrap it here.
      return { rocketList: data };
    } catch (error) {
      console.error("[RouteRegistry] Fetch error:", error.message);
      throw error; // Let middleware handle the failure
    }
  },

  // ---------------------------------------------------------------------------
  // ROUTE 2: CONTACT (Static)
  // ---------------------------------------------------------------------------
  [`${WORKSPACE_URI}/contact`]: null, // No data fetching needed
};
