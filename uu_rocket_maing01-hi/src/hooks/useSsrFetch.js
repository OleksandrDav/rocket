import { useState, useEffect, useRef } from "uu5g05";

/**
 * Custom Hook: useSsrFetch
 * ------------------------
 * A "Hybrid" data fetching hook designed for Server-Side Rendering (SSR).
 *
 * It implements the "Fetch-Then-Render" pattern:
 * 1. SERVER (Node.js): The middleware pre-fetches data and injects it into `window.__INITIAL_DATA__`.
 * 2. REACT (JSDOM/Client): This hook reads that injected data immediately upon initialization.
 * 3. RESULT: The component renders with data instantly (Status: 'ready'), avoiding "Loading..." spinners.
 *
 * Fallback:
 * If no injected data is found (e.g., normal client navigation), it behaves like a standard `fetch` hook.
 *
 * @param {string} key - The unique data key (e.g., 'rocketList') to look for in the injected global object.
 * @param {string} url - The API endpoint to fetch from if data is missing.
 */
export function useSsrFetch(key, url) {
  // ===========================================================================
  // 1. HYDRATION CHECK (The "Secret Sauce")
  // ===========================================================================
  // Before React even starts, we check if the server left a "gift" for us.
  const getServerData = () => {
    // Safety check: Ensure we are in a browser-like environment
    if (typeof window !== "undefined") {
      // PRIMARY CHECK: New SSR Middleware Injection
      // The middleware writes to `window.__INITIAL_DATA__` before rendering.
      if (window.__INITIAL_DATA__ && window.__INITIAL_DATA__[key]) {
        // console.log(`[useSsrFetch] 💧 Hydrating '${key}' from Server Data!`);
        return window.__INITIAL_DATA__[key];
      }

      // SECONDARY CHECK: Legacy/Fallback Support
      // Older SSR implementations might use this key. Kept for safety.
      if (window.__SSR_DATA__ && window.__SSR_DATA__[key]) {
        return window.__SSR_DATA__[key];
      }
    }
    return null;
  };

  // Run the check once during hook initialization (synchronous).
  const initialData = getServerData();

  // ===========================================================================
  // 2. STATE INITIALIZATION
  // ===========================================================================
  // If we found data, we start in 'ready' state. The user never sees 'pending'.
  const [data, setData] = useState(initialData);
  const [status, setStatus] = useState(initialData ? "ready" : "pending");
  const [error, setError] = useState(null);

  // Use a Ref to track if we have loaded data.
  // This persists across re-renders without triggering them.
  const hasLoaded = useRef(!!initialData);

  // ===========================================================================
  // 3. THE EFFECT (Client-Side Fetching logic)
  // ===========================================================================
  useEffect(() => {
    // 🛑 OPTIMIZATION: SKIP FETCH IF HYDRATED
    // If the server provided data, we do absolutely nothing here.
    if (hasLoaded.current) {
      // Just signal the middleware that we are "done" (useful for legacy polling logic)
      if (typeof window !== "undefined") window.__SSR_REQ_COMPLETE__ = true;
      return;
    }

    // 🚀 STANDARD FETCH (Fallback)
    // If we are here, it means we are navigating on the client side (SPA mode),
    // or the SSR pre-fetch failed. We must fetch the data ourselves.
    let cancelled = false;

    const fetchData = async () => {
      try {
        setStatus("pending");
        console.log(`[useSsrFetch] 📡 Client-side fetching: ${url}`);

        const response = await fetch(url, {
          method: "GET",
          headers: { Accept: "application/json" },
        });

        if (!response.ok) throw new Error(`Request failed: ${response.status}`);
        const result = await response.json();

        if (!cancelled) {
          setData(result);
          setStatus("ready");
          hasLoaded.current = true;
        }
      } catch (err) {
        if (!cancelled) {
          setError(err);
          setStatus("error");
        }
      } finally {
        // SIGNAL COMPLETE
        // This global flag tells the server "I am done loading" (if it was waiting).
        if (typeof window !== "undefined") {
          window.__SSR_REQ_COMPLETE__ = true;
        }
      }
    };

    fetchData();

    // Cleanup function to prevent setting state on unmounted components
    return () => {
      cancelled = true;
    };
  }, [key, url]); // Re-run if key or url changes

  return { data, status, error };
}
