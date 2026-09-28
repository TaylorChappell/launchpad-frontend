import { useEffect, useRef, type ReactNode } from "react";

export function SectionTabs({ label, items, value, onChange, className = "", panelId }: { label: string; items: { value: string; label: ReactNode }[]; value: string; onChange: (value: string) => void; className?: string; panelId: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const button = ref.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    const list = ref.current;
    if (!button || !list) return;
    const left = button.offsetLeft - list.offsetLeft;
    if (left < list.scrollLeft) list.scrollTo({ left, behavior: "instant" });
    else if (left + button.offsetWidth > list.scrollLeft + list.clientWidth) list.scrollTo({ left: left + button.offsetWidth - list.clientWidth, behavior: "instant" });
  }, [value]);
  return <div className={`section-tab-overflow ${className}`} ref={ref} role="tablist" aria-label={label} onKeyDown={event => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const index = items.findIndex(item => item.value === value);
    const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + items.length) % items.length;
    onChange(items[next].value);
    ref.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus({ preventScroll: true });
  }}>{items.map(item => <button key={item.value} id={`${panelId}-${item.value.toLowerCase()}`} role="tab" aria-controls={panelId} aria-selected={item.value === value} tabIndex={item.value === value ? 0 : -1} onClick={() => onChange(item.value)}>{item.label}</button>)}</div>;
}
