import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import "./launch-details-loading.css";

export function LaunchDetailsLoading({ message, children }: { message?: string; children?: ReactNode }) {
  return <section className="wizard-launching-screen launch-details-loading" aria-label="Preparing coin details" aria-busy={!message}>
    <div className="launching-water" aria-hidden="true"><i/><i/><i/><i/><i/><i/></div>
    <div className="launch-simple-status" role={message ? "alert" : "status"}>
      {!message && <span className="launching-orb"><Loader2 className="spin" aria-hidden="true"/></span>}
      <h1>{message ? "Coin details not ready" : "Loading coin details"}</h1>
      <p>{message || "Getting your launch ready to review."}</p>
      {children && <div className="launch-details-actions">{children}</div>}
    </div>
  </section>;
}
