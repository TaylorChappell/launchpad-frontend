export type AquaRewardMode = "holder_rewards" | "buyback_burn" | "jackpot";

export function RewardModeIcon({ mode, className = "" }: { mode: AquaRewardMode; className?: string }) {
  const common = {
    className: `aqua-reward-mode-icon ${className}`.trim(),
    viewBox: "0 0 48 48",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    "aria-hidden": true,
  } as const;

  if (mode === "buyback_burn") {
    return <svg {...common}>
      <path className="mode-icon-wash" d="M24 5.5c-4.2 6.1-9.2 11.6-9.2 18.2A9.2 9.2 0 0 0 24 33a9.2 9.2 0 0 0 9.2-9.3C33.2 17.1 28.2 11.6 24 5.5Z"/>
      <path className="mode-icon-line" d="M24 5.5c-4.2 6.1-9.2 11.6-9.2 18.2A9.2 9.2 0 0 0 24 33a9.2 9.2 0 0 0 9.2-9.3C33.2 17.1 28.2 11.6 24 5.5Z"/>
      <path className="mode-icon-solid" d="M24 17.1c-2.4 3.4-4.7 6.1-4.7 9a4.7 4.7 0 0 0 9.4 0c0-2.9-2.3-5.6-4.7-9Z"/>
      <path className="mode-icon-line" d="M8.3 20.4a16.9 16.9 0 0 1 7.2-9.5M39.7 27.6a16.9 16.9 0 0 1-7.2 9.5M11.7 11.1l4.2-.6-.6 4.2M36.3 36.9l-4.2.6.6-4.2"/>
      <path className="mode-icon-line mode-icon-fine" d="M8 27.7a16.9 16.9 0 0 0 8 10.1M40 20.3a16.9 16.9 0 0 0-8-10.1"/>
    </svg>;
  }

  if (mode === "jackpot") {
    return <svg {...common}>
      <circle className="mode-icon-bubble" cx="9" cy="14" r="2.2"/>
      <circle className="mode-icon-bubble" cx="17" cy="8.5" r="2.8"/>
      <circle className="mode-icon-solid" cx="24" cy="6.5" r="3.2"/>
      <circle className="mode-icon-bubble" cx="31" cy="8.5" r="2.8"/>
      <circle className="mode-icon-bubble" cx="39" cy="14" r="2.2"/>
      <path className="mode-icon-wash" d="M12.2 17.4h23.6v3.1c0 7-4.6 12.8-10.8 13.8v4.2h6.1v3.8H16.9v-3.8H23v-4.2c-6.2-1-10.8-6.8-10.8-13.8v-3.1Z"/>
      <path className="mode-icon-line" d="M12.2 17.4h23.6v3.1c0 7.7-5.3 14-11.8 14s-11.8-6.3-11.8-14v-3.1ZM24 34.5v4M17 42.3h14"/>
      <path className="mode-icon-line mode-icon-fine" d="M12.4 20.4H8.7v2.1c0 4.4 2.9 7.6 7 8.1M35.6 20.4h3.7v2.1c0 4.4-2.9 7.6-7 8.1"/>
      <path className="mode-icon-solid" d="M24 20.3c-2.6 3.3-4.6 5.7-4.6 8.2a4.6 4.6 0 0 0 9.2 0c0-2.5-2-4.9-4.6-8.2Z"/>
    </svg>;
  }

  return <svg {...common}>
    <path className="mode-icon-wash" d="M24 4.8c-5.1 7.2-11.7 14.1-11.7 22A11.7 11.7 0 0 0 24 38.5a11.7 11.7 0 0 0 11.7-11.7c0-7.9-6.6-14.8-11.7-22Z"/>
    <path className="mode-icon-line" d="M24 4.8c-5.1 7.2-11.7 14.1-11.7 22A11.7 11.7 0 0 0 24 38.5a11.7 11.7 0 0 0 11.7-11.7c0-7.9-6.6-14.8-11.7-22Z"/>
    <path className="mode-icon-line mode-icon-fine" d="M16.8 27c2.3-1.8 4.7-1.8 7.2 0s4.9 1.8 7.2 0M17.6 32c2.1-1.4 4.2-1.4 6.4 0s4.3 1.4 6.4 0"/>
    <circle className="mode-icon-solid" cx="17" cy="16.5" r="2.4"/>
    <circle className="mode-icon-solid" cx="24" cy="13.5" r="3"/>
    <circle className="mode-icon-solid" cx="31" cy="16.5" r="2.4"/>
    <path className="mode-icon-line mode-icon-fine" d="M17 19v3.1M24 17v5.1M31 19v3.1"/>
  </svg>;
}
