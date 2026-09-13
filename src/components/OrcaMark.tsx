export function OrcaMark({ className = "" }: { className?: string }) {
  return <img className={`orca-mark ${className}`.trim()} src={`${import.meta.env.BASE_URL}orca-logo.png`} alt="" aria-hidden="true"/>;
}
