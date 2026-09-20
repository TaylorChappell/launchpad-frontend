import type { Launch, MarketSnapshot } from "./types";

export type MarketPrice = Pick<Launch,"id"|"priceUsd"|"marketCapUsd"|"fdvUsd"|"priceUpdatedAt"|"priceStatus"|"aquaIndexed">;
export function mergeMarketPrice(launch:Launch, price:MarketPrice|undefined):Launch {
  if (!price || price.id!==launch.id || (price.priceUpdatedAt??0)<(launch.priceUpdatedAt??0)) return launch;
  return {...launch,...price};
}
export function isPriceLive(price:{priceUpdatedAt?:number|null;priceStatus?:string}, now=Date.now()) {
  return price.priceStatus==="live" && !!price.priceUpdatedAt && now-price.priceUpdatedAt>=-30_000 && now-price.priceUpdatedAt<=60_000;
}
export function withLatestMarketPoint(snapshots:MarketSnapshot[],launch:Launch|null):MarketSnapshot[] {
  if (!launch?.priceUpdatedAt || !isPriceLive(launch)) return snapshots;
  const latest=Math.max(0,...snapshots.map(point=>point.sampledAt));
  if (launch.priceUpdatedAt<latest) return snapshots;
  return [...snapshots.filter(point=>point.sampledAt!==launch.priceUpdatedAt),{sampledAt:launch.priceUpdatedAt,priceUsd:launch.priceUsd,marketCapUsd:launch.marketCapUsd,fdvUsd:launch.fdvUsd,tvlUsd:launch.tvlUsd,volume24hUsd:launch.volume24hUsd,holderCount:launch.holderCount,txCount:launch.txCount}];
}
