export type CommentCursor = { id: string; createdAt: number };
export function recentProjectUpdate(at: number | null | undefined, now = Date.now()) {
  return typeof at === "number" && Number.isFinite(at) && at <= now && now - at < 3_600_000;
}
export function newerComment(a: CommentCursor | null | undefined, b: CommentCursor | null | undefined) {
  return Boolean(a && (!b || a.createdAt > b.createdAt || a.createdAt === b.createdAt && a.id > b.id));
}
export function readCommentCursor(key: string): CommentCursor | null {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "null");
    return value && typeof value.id === "string" && Number.isSafeInteger(value.createdAt) && value.createdAt >= 0 ? value : null;
  } catch { return null; }
}
