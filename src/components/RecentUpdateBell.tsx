import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Link } from "react-router-dom";
import { recentProjectUpdate } from "../market-activity";

export function RecentUpdateBell({ at, launchId }: { at?: number | null; launchId?: string }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    setNow(Date.now());
    if (!at || !recentProjectUpdate(at)) return;
    const timer = window.setTimeout(() => setNow(Date.now()), Math.max(0, at + 3_600_000 - Date.now()));
    return () => window.clearTimeout(timer);
  }, [at]);
  if (!recentProjectUpdate(at, now)) return null;
  const icon = <Bell size={14} aria-hidden="true"/>;
  return launchId ? <Link className="market-update-link" to={`/token/${launchId}?tab=project`} title="New project update" aria-label="Read new project update">{icon}</Link>
    : <span className="market-update-indicator" title="New project update" aria-label="New project update">{icon}</span>;
}
