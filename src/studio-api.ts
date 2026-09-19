import { API_URL } from "./api";
export type StudioFile = {
  path: string;
  content: string;
  encoding: "utf8" | "base64";
  locked: boolean;
};
export type StudioLaunch = {
  name: string;
  symbol: string;
  description: string;
  stockMint: string;
  rewardMode: "holder_rewards" | "buyback_burn" | "jackpot";
  imagePath: string;
  xUrl: string;
  websiteUrl: string;
  telegramUrl: string;
  dexFundingEnabled: boolean;
  dexProfile: {
    description: string;
    bannerUrl: string;
    websiteUrl: string;
    xUrl: string;
    telegramUrl: string;
  };
};
export type StudioState = {
  name: string;
  launch: StudioLaunch;
  files: StudioFile[];
  folders: string[];
  lockedFields: Array<keyof StudioLaunch>;
};
export type StudioProject = {
  id: string;
  name: string;
  revision: number;
  state: StudioState;
  updated_at: number;
};
export type StudioJob = {
  progress?: string;
  id: string;
  project_id: string;
  kind: string;
  status: string;
  prompt: string;
  message?: string;
  error?: string;
  charged_raw: string;
  reserved_raw: string;
  charged_micro_usd: string | null;
  reserved_micro_usd: string | null;
  created_at: number;
  result?: {
    message: string;
    launch?: Partial<StudioLaunch>;
    files: StudioFile[];
    deletePaths: string[];
  };
};
export type StudioConfig = {
  enabled: boolean;
  paidEnabled: boolean;
  setup: {
    ready: boolean;
    issues: Array<{
      code: string;
      title: string;
      detail: string;
      variables: string[];
    }>;
  };
  decimals: number | null;
  mint: string;
  depositsEnabled: boolean;
  depositSetup: StudioConfig["setup"];
  depositPrice: {usdPrice:string;observedAt:number} | null;
  model: string;
  imageModel: string;
  knowledge: {
    governance: boolean;
    burn: boolean;
    jackpot: boolean;
    pairs: Array<{ mint: string; symbol: string; name: string }>;
  };
};
export class StudioApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export const studioSessionKey = (wallet: string) => `aqua:studio:${wallet}`;
export function studioSession(wallet: string) {
  try {
    const session = JSON.parse(
      sessionStorage.getItem(studioSessionKey(wallet)) ?? "null",
    );
    return session?.expiresAt > Date.now() ? String(session.token) : "";
  } catch {
    return "";
  }
}
export async function studioRequest<T>(
  path: string,
  token = "",
  body?: unknown,
  method?: string,
): Promise<T> {
  const response = await fetch(`${API_URL}/studio${path}`, {
    method: method ?? (body === undefined ? "GET" : "POST"),
    cache: "no-store",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new StudioApiError(
      data.error ?? `Studio returned ${response.status}`,
      response.status,
    );
  }
  return response.json();
}
export function studioAssetUrl(file: StudioFile) {
  const ext = file.path.split(".").pop()?.toLowerCase(),
    mime =
      (
        {
          png: "image/png",
          jpg: "image/jpeg",
          jpeg: "image/jpeg",
          gif: "image/gif",
          webp: "image/webp",
          svg: "image/svg+xml",
          ico: "image/x-icon",
          woff2: "font/woff2",
        } as Record<string, string>
      )[ext ?? ""] ?? "application/octet-stream";
  return file.encoding === "base64"
    ? `data:${mime};base64,${file.content}`
    : `data:${mime};charset=utf-8,${encodeURIComponent(file.content)}`;
}
export function studioAssetFile(file: StudioFile) {
  if (file.encoding !== "base64")
    throw new Error(
      "Choose an uploaded PNG, JPEG, WebP or GIF for your launch artwork.",
    );
  const bytes = Uint8Array.from(atob(file.content), (c) => c.charCodeAt(0));
  return new File([bytes], file.path.split("/").pop()!, {
    type: studioAssetUrl(file).split(";")[0].slice(5),
  });
}
export function aquaAmount(raw: string, decimals: number | null = 6) {
  const precision = decimals ?? 6,
    negative = raw.startsWith("-"),
    digits = (negative ? raw.slice(1) : raw).padStart(precision + 1, "0");
  const whole = precision ? digits.slice(0, -precision) : digits,
    part = precision ? digits.slice(-precision).replace(/0+$/, "") : "";
  return `${negative ? "-" : ""}${BigInt(whole).toLocaleString()}${part ? "." + part : ""}`;
}
export function aquaRaw(value: string, decimals: number) {
  if (!/^\d+(\.\d+)?$/.test(value))
    throw new Error("Enter a positive AQUA amount.");
  const [whole, fraction = ""] = value.split(".");
  if (fraction.length > decimals)
    throw new Error(`AQUA supports ${decimals} decimal places.`);
  const raw =
    BigInt(whole) * 10n ** BigInt(decimals) +
    BigInt(fraction.padEnd(decimals, "0") || "0");
  if (raw <= 0n) throw new Error("Enter a positive AQUA amount.");
  return raw.toString();
}
export function usdCredit(microUsd: string) {
  const negative = microUsd.startsWith("-");
  const amount = aquaAmount(negative ? microUsd.slice(1) : microUsd,6);
  const [whole,fraction=""] = amount.split(".");
  return `${negative ? "-" : ""}$${whole}.${fraction.padEnd(2,"0")}`;
}
