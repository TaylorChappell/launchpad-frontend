import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { Toaster } from "sonner";

export type Theme = "light" | "dark";
export const THEME_KEY = "aqua:theme";
const ThemeContext = createContext<{ theme: Theme; toggleTheme: () => void } | null>(null);

function readTheme(): Theme {
  try { return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light"; }
  catch { return document.documentElement.dataset.theme === "dark" ? "dark" : "light"; }
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document.documentElement.style.backgroundColor = theme === "dark" ? "#071722" : "#D4EDFC";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#071722" : "#D4EDFC");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readTheme);
  useEffect(() => { applyTheme(theme); }, [theme]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== THEME_KEY && event.key !== null) return;
      // Ignore sessionStorage events; storage can throw in privacy mode.
      try { if (event.storageArea && event.storageArea !== localStorage) return; } catch { return; }
      const next = event.newValue === "dark" ? "dark" : "light";
      applyTheme(next); setTheme(next);
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    const update = () => { applyTheme(next); flushSync(() => setTheme(next)); };
    if (document.startViewTransition && document.visibilityState === "visible" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // A rapid second toggle or a hidden tab can skip the optional animation.
      void document.startViewTransition(update).ready.catch(() => {});
    } else update();
    try { localStorage.setItem(THEME_KEY, next); } catch { /* Keep the toggle usable when storage is blocked. */ }
  };
  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside ThemeProvider");
  return value;
}

export function ThemeToaster() {
  const { theme } = useTheme();
  return <Toaster theme={theme} richColors />;
}
