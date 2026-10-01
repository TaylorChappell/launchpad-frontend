import { Moon, Sun } from "lucide-react";
import { useTheme } from "../theme";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";
  const label = dark ? "Switch to light mode" : "Switch to dark mode";
  return <button type="button" className="theme-toggle" onClick={toggleTheme} aria-label={label} aria-pressed={dark} title={label}>
    <span className="theme-toggle-icons" aria-hidden="true"><Sun className="theme-sun" size={19}/><Moon className="theme-moon" size={19}/></span>
  </button>;
}
