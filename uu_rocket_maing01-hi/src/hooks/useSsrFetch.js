import { useState, useEffect, useRef } from "uu5g05";

/**
 * useSsrFetch
 * -----------
 * An isomorphic data-fetching hook that facilitates state hydration
 * from Server-Side Rendering (SSR) to the client-side environment.
 * * Execution Pattern:
 * 1. Synchronous Hydration: On initial mount, the hook attempts to resolve state
 * from 'window.__INITIAL_DATA__' injected by the SSR middleware.
 * 2. Asynchronous Fallback: If no server-side state is detected, the hook
 * executes a standard client-side fetch operation.
 * * @param {string} key - Unique identifier used to locate pre-fetched state in the global scope.
 * @param {string} url - Remote endpoint for client-side data resolution.
 */
export function useSsrFetch(key, url) {
  // ===========================================================================
  // 1. STATE RESOLUTION (Hydration)
  // ===========================================================================
  /**
   * Attempts to retrieve pre-fetched data from the global window object.
   * This allows the component to initialize with a populated state,
   * bypassing the 'pending' status during the initial render.
   */
  const resolveInitialData = () => {
    if (typeof window !== "undefined") {
      // Primary resolution path for the current SSR implementation
      if (window.__INITIAL_DATA__ && window.__INITIAL_DATA__[key]) {
        return window.__INITIAL_DATA__[key];
      }

      // Legacy support for alternate SSR data structures
      if (window.__SSR_DATA__ && window.__SSR_DATA__[key]) {
        return window.__SSR_DATA__[key];
      }
    }
    return null;
  };

  const initialData = resolveInitialData();

  // ===========================================================================
  // 2. STATE INITIALIZATION
  // ===========================================================================
  // Status defaults to 'ready' if initialData is present to prevent layout shift.
  const [data, setData] = useState(initialData);
  const [status, setStatus] = useState(initialData ? "ready" : "pending");
  const [error, setError] = useState(null);

  // Persistence ref to track synchronization status across render cycles.
  const hasResolved = useRef(!!initialData);

  // ===========================================================================
  // 3. EFFECT LIFECYCLE (Client-Side Synchronization)
  // ===========================================================================
  useEffect(() => {
    // Optimization: Skip network request if state was successfully hydrated from the server.
    if (hasResolved.current) {
      if (typeof window !== "undefined") window.__SSR_REQ_COMPLETE__ = true;
      return;
    }

    let isCancelled = false;

    /**
     * Executes asynchronous data fetching for client-side navigation or fallback scenarios.
     */
    const fetchData = async () => {
      try {
        setStatus("pending");

        const response = await fetch(url, {
          method: "GET",
          headers: { Accept: "application/json" },
        });

        if (!response.ok) throw new Error(`Fetch operation failed: ${response.status}`);
        const result = await response.json();

        if (!isCancelled) {
          setData(result);
          setStatus("ready");
          hasResolved.current = true;
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err);
          setStatus("error");
        }
      } finally {
        // Signal task completion to the environment (JSDOM/Server context)
        if (typeof window !== "undefined") {
          window.__SSR_REQ_COMPLETE__ = true;
        }
      }
    };

    fetchData();

    return () => {
      isCancelled = true;
    };
  }, [key, url]);

  return { data, status, error };
}
