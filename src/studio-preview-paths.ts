import type { StudioFile } from "./studio-api";

const previewOrigin = "https://studio-preview.invalid";
export function studioPreviewPages(files: StudioFile[]) {
  return files.filter(file => file.path.startsWith("frontend/") && /\.html?$/i.test(file.path) && file.encoding === "utf8")
    .map(file => file.path).sort((a,b) => a === "frontend/index.html" ? -1 : b === "frontend/index.html" ? 1 : a.localeCompare(b));
}

export function studioPreviewPath(reference: string, from = "frontend/index.html") {
  if (/^[a-z][a-z\d+.-]*:|^\/\/|[\\\x00-\x1f]/i.test(reference.trim())) return null;
  try {
    const url = new URL(reference, previewOrigin + "/" + from.replace(/^frontend\//, ""));
    if (url.origin !== previewOrigin) return null;
    const path = "frontend" + decodeURIComponent(url.pathname);
    if (path.split("/").some(part => part === ".." || part === ".") || path.includes("\\")) return null;
    return {path, search:url.search, hash:url.hash};
  } catch { return null; }
}

export function studioPreviewTarget(files: StudioFile[], reference: string, from = "frontend/index.html") {
  const resolved = studioPreviewPath(reference,from);
  if (!resolved) return null;
  const pages = studioPreviewPages(files);
  const candidates = resolved.path.endsWith("/") ? [resolved.path+"index.html",resolved.path+"index.htm"]
    : [resolved.path,resolved.path+".html",resolved.path+"/index.html",resolved.path+"/index.htm"];
  const path = candidates.find(candidate => pages.includes(candidate));
  return path ? {...resolved,path,location:path+resolved.search+resolved.hash} : null;
}
