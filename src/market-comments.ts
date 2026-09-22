export type MarketComment = { id: string; launchId: string; authorWallet: string; body: string; createdAt: number };
export type CommentPage = { comments: MarketComment[]; hasMore: boolean; nextCursor: string | null };

export function mergeComments(current: MarketComment[], incoming: MarketComment[]) {
  return [...new Map([...current, ...incoming].map(comment => [comment.id, comment])).values()]
    .sort((a, b) => b.createdAt - a.createdAt || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
}
