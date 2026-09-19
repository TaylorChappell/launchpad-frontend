import { studioAssetUrl, type StudioFile } from "./studio-api";
import { studioPreviewPath } from "./studio-preview-paths";
import { studioPreviewBridge, type PreviewBridgeOptions } from "./studio-preview-bridge";
// Project code runs only in an opaque sandbox; form-action CSP blocks network submissions.
export function studioPreview(
  files: StudioFile[],
  entry = "frontend/index.html",
  options?: PreviewBridgeOptions & {onIssue?:(message:string)=>void},
) {
  const map = new Map(files.map((f) => [f.path, f]));
  const resolve = (base: string, path: string) => {
    const resolved = studioPreviewPath(path,base);
    return resolved ? map.get(resolved.path) ?? null : null;
  };
  const source =
    map.get(entry)?.content ??
    "<main><h1>Add frontend/index.html to preview your site.</h1></main>";
  const doc = new DOMParser().parseFromString(source, "text/html");
  doc
    .querySelectorAll("base,meta[http-equiv],iframe,object,embed")
    .forEach((e) => e.remove());
  const css = (text: string, path: string) =>
    text.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/g, (_all, _quote, url) => {
      if (/^data:/i.test(url)) return `url("${url.replace(/"/g, "%22")}")`;
      const f = resolve(path, url);
      return f ? `url("${studioAssetUrl(f)}")` : 'url("")';
    });
  doc
    .querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')
    .forEach((link) => {
      const f = resolve(entry, link.getAttribute("href") ?? "");
      if (!f) options?.onIssue?.("Missing stylesheet: " + link.getAttribute("href"));
      const style = doc.createElement("style");
      style.textContent = f ? css(f.content, f.path) : "";
      link.replaceWith(style);
    });
  doc.querySelectorAll<HTMLStyleElement>("style").forEach((style) => {
    style.textContent = css(style.textContent ?? "", entry);
  });
  doc
    .querySelectorAll<HTMLElement>("[style]")
    .forEach((el) =>
      el.setAttribute("style", css(el.getAttribute("style") ?? "", entry)),
    );
  doc.querySelectorAll<HTMLScriptElement>("script[src]").forEach((script) => {
    const src = script.getAttribute("src") ?? "";
    const f = resolve(entry, src);
    script.removeAttribute("integrity");
    script.removeAttribute("crossorigin");
    // A classic inline script ignores defer. Keep a real script source so DOM
    // readiness and the ordering of config, deferred and module scripts survive.
    if (f?.encoding === "utf8") script.src = "data:text/javascript;charset=utf-8,"+encodeURIComponent(f.content);
    else {
      options?.onIssue?.("Missing script: " + src);
      script.remove();
    }
  });
  doc.querySelectorAll<HTMLElement>("[src]:not(script),[poster]").forEach((el) => {
    for (const attr of ["src", "poster"]) {
      const path = el.getAttribute(attr);
      if (path) {
        if (/^data:(image|audio|video)\//i.test(path)) continue;
        const f = resolve(entry, path);
        const hash = studioPreviewPath(path,entry)?.hash ?? "";
        el.setAttribute(attr, f ? studioAssetUrl(f)+hash : "");
      }
    }
    el.removeAttribute("srcset");
  });
  doc
    .querySelectorAll("[srcset]")
    .forEach((el) => el.removeAttribute("srcset"));
  const policy = doc.createElement("meta");
  policy.httpEquiv = "Content-Security-Policy";
  policy.content =
    "default-src 'none'; script-src 'unsafe-inline' data: blob:; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; form-action 'none'; base-uri about:;";
  if (options) {
    const bridge = doc.createElement("script");
    const config = JSON.stringify({channel:options.channel,location:options.location,storage:options.storage}).replace(/</g,"\\u003c");
    bridge.textContent = `(${studioPreviewBridge.toString()})(${config});`;
    doc.head.prepend(bridge);
  }
  // srcdoc otherwise inherits AQUA's URL as its base. A native #section link
  // then loads AQUA inside the sandbox and appears blank if the click bridge
  // is unavailable or a page handler stops propagation. Keep native fragments
  // in this document too, without rewriting authored hrefs or their selectors.
  const base = doc.createElement("base");
  base.href = "about:srcdoc";
  doc.head.prepend(base);
  doc.head.prepend(policy);
  return "<!doctype html>" + doc.documentElement.outerHTML;
}
