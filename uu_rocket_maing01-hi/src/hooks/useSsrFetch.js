import { useState, useEffect, useRef } from "uu5g05";

/**
 * Custom Hook: useSsrFetch
 * Now supports "Hydration" from Server-Side Pre-fetching.
 */
export function useSsrFetch(key, url) {
  // 1. CHECK FOR SERVER INJECTED DATA (The "Fetch-Then-Render" path)
  const getServerData = () => {
    // Check global scope for the data key we expect (e.g. "rocketList")
    if (typeof window !== "undefined" && window.__INITIAL_DATA__ && window.__INITIAL_DATA__[key]) {
      // console.log(`[useSsrFetch] 💧 Hydrating '${key}' from Server Data!`);
      return window.__INITIAL_DATA__[key];
    }
    // Fallback: Check for legacy __SSR_DATA__ (optional, for backward compatibility)
    if (typeof window !== "undefined" && window.__SSR_DATA__ && window.__SSR_DATA__[key]) {
      return window.__SSR_DATA__[key];
    }
    return null;
  };

  const initialData = getServerData();

  // 2. INITIALIZE STATE
  // If initialData exists, status is 'ready'. No loading state!
  const [data, setData] = useState(initialData);
  const [status, setStatus] = useState(initialData ? "ready" : "pending");
  const [error, setError] = useState(null);

  // Mark as loaded if we have data, so we don't fetch again
  const hasLoaded = useRef(!!initialData);

  useEffect(() => {
    // If we already have data (from server), SKIP the fetch.
    if (hasLoaded.current) {
      // Just signal completion immediately for the middleware
      if (typeof window !== "undefined") window.__SSR_REQ_COMPLETE__ = true;
      return;
    }

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
        // SIGNAL COMPLETE: Tell SSR Middleware "We are finished!"
        if (typeof window !== "undefined") {
          window.__SSR_REQ_COMPLETE__ = true;
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [key, url]);

  return { data, status, error };
}
