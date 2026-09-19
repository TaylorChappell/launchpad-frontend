import { studioAssetUrl, type StudioFile } from "./studio-api";
// Never execute project code in the parent window. The caller must use sandbox="allow-scripts".
export function studioPreview(
  files: StudioFile[],
  entry = "frontend/index.html",
) {
  const map = new Map(files.map((f) => [f.path, f]));
  const resolve = (base: string, path: string) => {
    if (/^(data:|https?:|\/\/|#)/i.test(path)) return null;
    const parts = path.startsWith("/")
      ? ["frontend"]
      : base.split("/").slice(0, -1);
    for (const p of path.split(/[?#]/)[0].split("/")) {
      if (p === "..") parts.pop();
      else if (p && p !== ".") parts.push(p);
    }
    return map.get(parts.join("/")) ?? null;
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
    const f = resolve(entry, script.getAttribute("src") ?? "");
    script.removeAttribute("src");
    script.removeAttribute("integrity");
    script.textContent = f?.encoding === "utf8" ? f.content : "";
  });
  doc.querySelectorAll<HTMLElement>("[src],[poster]").forEach((el) => {
    for (const attr of ["src", "poster"]) {
      const path = el.getAttribute(attr);
      if (path) {
        const f = resolve(entry, path);
        el.setAttribute(attr, f ? studioAssetUrl(f) : "");
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
    "default-src 'none'; script-src 'unsafe-inline' blob:; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; form-action 'none'; base-uri 'none';";
  doc.head.prepend(policy);
  return "<!doctype html>" + doc.documentElement.outerHTML;
}
