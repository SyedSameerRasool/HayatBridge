import { useEffect, useRef } from "react";

/** Signs the admin out after a period of no keyboard/pointer activity. */
export function useIdleLogout(onIdle: () => void, timeoutMs = 15 * 60 * 1000) {
  const handler = useRef(onIdle);
  handler.current = onIdle;

  useEffect(() => {
    if (typeof window === "undefined") return;
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => handler.current(), timeoutMs);
    };
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [timeoutMs]);
}
