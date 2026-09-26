import { useState, type CSSProperties, type ReactNode } from "react";

export function PercentControl({ id, label, hint, value, min, max, step, disabled, onChange, children }: {
  id: string; label: string; hint: string; value: number; min: number; max: number; step: number;
  disabled?: boolean; onChange: (bps: number) => void; children?: ReactNode;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const normalize = (number: number) => Math.min(max, Math.max(min, min + Math.round((number - min) / step) * step));
  const commit = () => {
    if (draft !== null && draft.trim() !== "" && Number.isFinite(Number(draft))) onChange(normalize(Number(draft) * 100));
    setDraft(null);
  };
  return <section className={`launch-setting-card${disabled ? " is-disabled" : ""}`}>
    <header><label htmlFor={id}>{label}</label><div className="percent-input">
      <input id={id} type="number" inputMode="decimal" min={min / 100} max={max / 100} step={step / 100}
        value={draft ?? value / 100} disabled={disabled} aria-describedby={`${id}-hint`}
        onChange={event => {
          const text = event.target.value; setDraft(text);
          const bps = Number(text) * 100;
          if (text.trim() && Number.isFinite(bps) && bps >= min && bps <= max) onChange(normalize(bps));
        }} onBlur={commit} onKeyDown={event => {
          if (event.key === "Enter") { event.preventDefault(); commit(); }
          if (event.key === "Escape") setDraft(null);
        }}/><span aria-hidden="true">%</span>
    </div></header>
    <p id={`${id}-hint`}>{hint}</p>
    <input className="percent-slider" type="range" aria-label={`${label} slider`} aria-valuetext={`${value / 100}%`}
      min={min} max={max} step={step} value={value} disabled={disabled}
      style={{ "--range-fill": `${(value - min) / (max - min) * 100}%` } as CSSProperties}
      onChange={event => { setDraft(null); onChange(Number(event.target.value)); }}/>
    <div className="launch-setting-limits"><span>{min / 100}%</span><span>{max / 100}%</span></div>
    {children}
  </section>;
}
