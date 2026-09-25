import { useEffect, useRef } from "react";

// A wallet picker can sit above another dialog without unlocking the page or
// letting both focus traps handle the same key press.
const dialogs: Array<{ element: HTMLElement | null }> = [];
let originalOverflow = "";
let originalRootOverflow = "";

export function useDialog<T extends HTMLElement = HTMLElement>(open: boolean, onClose: () => void, returnFocus?: HTMLElement | null) {
  const ref = useRef<T>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const prior = returnFocus ?? document.activeElement as HTMLElement | null;
    const entry = { element: ref.current };
    if (!dialogs.length) {
      originalOverflow = document.body.style.overflow;
      originalRootOverflow = document.documentElement.style.overflow;
    }
    dialogs.push(entry);
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    const elements = () => Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]') ?? []).filter(el => el.getClientRects().length);
    elements()[0]?.focus({ preventScroll: true });
    const keydown = (e: KeyboardEvent) => {
      if (dialogs.at(-1) !== entry) return;
      if (e.key === "Escape") { e.preventDefault(); close.current(); }
      if (e.key !== "Tab") return;
      const list = elements(), first = list[0], last = list.at(-1);
      if (!first) { e.preventDefault(); return; }
      if (e.shiftKey && (document.activeElement === first || !ref.current?.contains(document.activeElement))) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !ref.current?.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      const wasTop = dialogs.at(-1) === entry;
      dialogs.splice(dialogs.indexOf(entry), 1);
      if (!dialogs.length) {
        document.body.style.overflow = originalOverflow;
        document.documentElement.style.overflow = originalRootOverflow;
      }
      if (wasTop && prior?.isConnected) prior.focus({ preventScroll: true });
    };
  }, [open]);
  return ref;
}
