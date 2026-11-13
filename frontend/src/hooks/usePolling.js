import { useEffect, useRef } from "react";

export default function usePolling(fn, deps = [], intervalMs = 10000) {
  const saved = useRef(fn);
  saved.current = fn;

  useEffect(() => {
    let stopped = false;
    const tick = () => {
      if (!stopped && document.visibilityState === "visible") saved.current();
    };
    saved.current();
    const id = setInterval(tick, intervalMs);
    document.addEventListener("visibilitychange", tick);
    return () => {
      stopped = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
