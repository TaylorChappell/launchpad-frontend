import { useRuntime } from "../context";

export function LiquidityFlow() {
  const { config } = useRuntime();
  return <div className="liquidity-flow" aria-label="Animated path from a virtual curve to stock rewards and Orca liquidity">
    <div className="flow-topline"><span>TRANSACTION MODEL</span><b>{config.network === "devnet" ? "DEVNET PREVIEW" : "MAINNET"}</b></div>
    <svg viewBox="0 0 620 360" role="img">
      <defs>
        <linearGradient id="curveStroke" x1="44" y1="280" x2="568" y2="60" gradientUnits="userSpaceOnUse"><stop stopColor="#1ED6C6" /><stop offset=".55" stopColor="#6EECF4" /><stop offset="1" stopColor="#2F9EFF" /></linearGradient>
        <linearGradient id="curveFill" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#36DCE7" stopOpacity=".26"/><stop offset="1" stopColor="#36DCE7" stopOpacity="0"/></linearGradient>
        <filter id="softGlow"><feGaussianBlur stdDeviation="7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <g className="flow-grid-lines"><path d="M42 70H578M42 130H578M42 190H578M42 250H578M42 310H578" /><path d="M110 44V318M210 44V318M310 44V318M410 44V318M510 44V318" /></g>
      <path className="curve-area" d="M48 294C142 292 202 270 254 230c58-45 86-111 133-143 45-31 96-32 178-33v252H48Z" />
      <path className="curve-line-glow" d="M48 294C142 292 202 270 254 230c58-45 86-111 133-143 45-31 96-32 178-33" />
      <path className="curve-line" pathLength="1" d="M48 294C142 292 202 270 254 230c58-45 86-111 133-143 45-31 96-32 178-33" />
      <g className="flow-point point-curve"><circle cx="186" cy="273" r="6"/><circle cx="186" cy="273" r="15"/><text x="160" y="246">CURVE</text></g>
      <g className="flow-point point-vault"><circle cx="356" cy="112" r="6"/><circle cx="356" cy="112" r="15"/><text x="326" y="87">RESERVE</text></g>
      <g className="flow-point point-orca"><circle cx="536" cy="55" r="6"/><circle cx="536" cy="55" r="15"/><text x="505" y="92">ORCA</text></g>
    </svg>
    <div className="flow-readout"><div><small>Curve reserve</small><strong>0.00 SOL</strong></div><div><small>Reward route</small><strong>Optional 1%</strong></div><div><small>Graduation</small><strong>{config.graduationSol} SOL</strong></div></div>
  </div>;
}
