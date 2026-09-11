export type AquaGlyphKind = "revenue" | "buyback" | "rewards" | "markets" | "earn" | "aquaBuy" | "growth";

export function AquaGlyph({ kind }: { kind: AquaGlyphKind }) {
  return <svg className="aqua-glyph" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    {kind === "revenue" && <>
      <path d="M4.2 14.1c2.2-1.8 4.1-1.8 6.1 0s4 1.8 6 0 3.1-1.6 3.9-1.4"/>
      <path d="M6.1 10.2V7.8c0-1.1 2.6-2 5.9-2s5.9.9 5.9 2v4.7"/>
      <path d="M6.1 7.8c0 1.1 2.6 2 5.9 2s5.9-.9 5.9-2"/>
      <path d="M7.3 17.4c1.6.7 3.6 1 5.7.8 2.2-.1 4-.7 5-1.4"/>
      <circle cx="4.2" cy="9.8" r=".75" className="glyph-bubble"/>
    </>}
    {kind === "buyback" && <>
      <path d="M12 4.1c-1.2 2-4.5 5.4-4.5 8.6A4.5 4.5 0 0 0 12 17.2a4.5 4.5 0 0 0 4.5-4.5C16.5 9.5 13.2 6.1 12 4.1Z"/>
      <path d="M5.2 8.1A7.8 7.8 0 0 0 4 12.2c0 4.4 3.6 7.8 8 7.8 3.5 0 6.4-2 7.5-5"/>
      <path d="m17.1 15.8 2.6-1.2.9 2.7"/>
      <circle cx="5.1" cy="5.1" r=".8" className="glyph-bubble"/>
    </>}
    {kind === "rewards" && <>
      <rect x="4" y="5.2" width="16" height="13.7" rx="2.4"/>
      <path d="M7 15.3c1.6-2.3 3.1-1.3 4.3-3.1 1-1.4 2.1-1.8 3.1-.5.8 1 1.5.7 2.6-.5"/>
      <path d="M7 8.2h3.2"/>
      <circle cx="17.2" cy="8.2" r="1" className="glyph-bubble"/>
    </>}
    {kind === "markets" && <>
      <path d="M4 17.2c2.2-2.1 4.2-2.1 6.3 0s4.1 2.1 6.2 0c1.3-1.3 2.4-1.8 3.5-1.4"/>
      <path d="M6.2 13V9.2M10.1 14.3V5.5M14 13.9V8M17.9 12.8V6.7"/>
      <path d="M4.7 10.8 9.9 6l4 3.1 5.3-5"/>
      <circle cx="19.1" cy="4.1" r=".8" className="glyph-bubble"/>
    </>}
    {kind === "earn" && <>
      <path d="M4.1 15.2c2-1.6 3.8-1.6 5.7 0s3.7 1.6 5.6 0 3.1-1.6 4.5-1.2"/>
      <path d="M6 18.2h12"/>
      <path d="M8 11.3V7.8h8v3.5"/>
      <path d="M10.3 7.8V5.3h3.4v2.5"/>
      <circle cx="18.6" cy="8.2" r="1" className="glyph-bubble"/>
    </>}
    {kind === "aquaBuy" && <>
      <path d="M12 5.1c-1 1.7-3.6 4.4-3.6 7A3.6 3.6 0 0 0 12 15.7a3.6 3.6 0 0 0 3.6-3.6c0-2.6-2.6-5.3-3.6-7Z"/>
      <path d="M4.2 10.2a8 8 0 0 1 13.5-4.4"/>
      <path d="m15.4 3.9 2.7 1.5-1.6 2.7"/>
      <path d="M19.8 13.8a8 8 0 0 1-13.5 4.4"/>
      <path d="m8.6 20.1-2.7-1.5 1.6-2.7"/>
    </>}
    {kind === "growth" && <>
      <path d="M12 4.2c-1.1 1.9-4 4.9-4 7.7a4 4 0 0 0 8 0c0-2.8-2.9-5.8-4-7.7Z"/>
      <path d="M12 16v3.7M12 18.1c-1.8-1.9-3.6-2.2-5.4-1.5M12 18.1c1.8-1.9 3.6-2.2 5.4-1.5"/>
      <path d="M5 21h14"/>
      <circle cx="18.8" cy="8.2" r=".8" className="glyph-bubble"/>
    </>}
  </svg>;
}
