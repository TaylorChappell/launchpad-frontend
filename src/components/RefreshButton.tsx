import { useEffect, useRef, useState, type ComponentProps } from "react";

// Keep click feedback visible even when a cached refresh finishes immediately.
// Existing request-driven .spin states continue after this minimum animation.
export function RefreshButton({onClick, className = "", children, ...props}: ComponentProps<"button">) {
  const [spinning, setSpinning] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return <button {...props} className={`refresh-feedback ${className}`} data-refreshing={spinning || undefined} onClick={event => {
    clearTimeout(timer.current);
    setSpinning(true);
    timer.current = setTimeout(() => setSpinning(false), 650);
    onClick?.(event);
  }}>{children}</button>;
}
