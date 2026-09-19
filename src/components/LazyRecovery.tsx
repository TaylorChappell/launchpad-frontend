import { lazy, type ComponentType } from "react";
import { RefreshCw } from "lucide-react";
import "./lazy-recovery.css";

function PageAssetRecovery() {
  function reload() {
    const url = new URL(window.location.href);
    url.searchParams.set("aqua_reload", String(Date.now()));
    window.location.assign(url.href);
  }
  return <section className="aqua-asset-recovery" role="alert">
    <RefreshCw size={25} aria-hidden="true" />
    <h2>This page needs a refresh.</h2>
    <p>AQUA may have updated, or a page file could not be downloaded. Reload to get the current version.</p>
    <button onClick={reload}>Reload AQUA <RefreshCw size={15} /></button>
    <small>Running Studio jobs continue in the background. Save any open edits before reloading.</small>
  </section>;
}

// Handle missing deployment assets at the lazy component boundary. In the code
// editor this leaves the surrounding Studio and its unsaved draft mounted.
// Never reload automatically and discard an edit or interrupt a wallet prompt.
export function lazyWithRecovery<T extends ComponentType<any>>(load: () => Promise<{default: T}>) {
  return lazy(async () => {
    try { return await load(); }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/unable to preload css|failed to fetch dynamically imported module|importing a module script failed|loading (?:css )?chunk|error loading dynamically imported module/i.test(message)) throw error;
      return {default: PageAssetRecovery as unknown as T};
    }
  });
}
