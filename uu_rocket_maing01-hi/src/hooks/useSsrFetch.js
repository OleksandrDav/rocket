import { useState, useEffect, useRef } from "uu5g05";

/**
 * Custom Hook for Server-Side Rendering Data Fetching
 * @param {string} key - Unique identifier for this data (e.g., "rocketList")
 * @param {string} url - API Endpoint to fetch
 * @returns {object} { data, status, error }
 */
export function useSsrFetch(key, url) {
  // 1. HYDRATION: Initialize directly from Server Data if it exists
  const getInitialData = () => {
    if (typeof window !== "undefined" && window.__SSR_DATA__ && window.__SSR_DATA__[key]) {
      return window.__SSR_DATA__[key];
    }
    return null;
  };

  const initialData = getInitialData();

  // 2. STATE: Start as "ready" if we have data, otherwise "pending"
  const [data, setData] = useState(initialData);
  const [status, setStatus] = useState(initialData ? "ready" : "pending");
  const [error, setError] = useState(null);

  // Ref prevents double-fetching in React StrictMode
  const hasLoaded = useRef(!!initialData);

  useEffect(() => {
    // If we already have data (from server or previous render), do nothing.
    if (hasLoaded.current) return;

    let cancelled = false;

    const fetchData = async () => {
      try {
        setStatus("pending");

        const response = await fetch(url, {
          method: "GET",
          headers: { Accept: "application/json" },
        });

        if (!response.ok) {
          throw new Error(`Request failed: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();

        if (!cancelled) {
          // 3. SSR SAVE: Save data to window for the client
          if (typeof window !== "undefined") {
            window.__SSR_DATA__ = window.__SSR_DATA__ || {};
            window.__SSR_DATA__[key] = result;
          }

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
        // 4. SIGNAL COMPLETE: Tell SSR Middleware "We are finished!"
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
