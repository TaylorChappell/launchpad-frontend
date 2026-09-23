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
    bannerPath?: string;
    websiteUrl: string;
    xUrl: string;
    telegramUrl: string;
  };
};
export type StudioState = {
  name: string;
  frontendVariables?: Record<string,string>;
  autoFillCA?: boolean | null;
  launch: StudioLaunch;
  files: StudioFile[];
  folders: string[];
  lockedFields: Array<keyof StudioLaunch>;
};
export type StudioHosting = {
  configurationSupported?: boolean;
  enabled: boolean;
  domain: string;
  prefix: string;
  site: { slug: string; url: string; published: boolean; revision: number | null; publishedAt: number | null } | null;
};
export type StudioProject = {
  hostedWebsiteUrl?: string | null;
  active_job?: { id: string; status: string; progress?: string } | null;
  id: string;
  name: string;
  revision: number;
  state: StudioState;
  updated_at: number;
};
export type StudioSurveyAnswer = { topic?:"creative"|"contract_address"; question:string; answer:string };
export type StudioSurveyData = {
  task:"website"|"image"|"chat";
  title:string;
  questions:Array<{id:string;topic?:"creative"|"contract_address";question:string;options:Array<{label:string;description:string}>}>;
};
export type StudioJob = {
  survey_answers?: StudioSurveyAnswer[];
  revision?: number;
  applied_at?: number | null;
  has_changes?: boolean;
  effort?: "low" | "medium" | "high";
  credit_exempt?: boolean;
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
    frontendVariables?: Record<string,string>;
    autoFillCA?: boolean;
    launch?: Partial<StudioLaunch>;
    files: StudioFile[];
    deletePaths: string[];
  };
};
export type StudioConfig = {
  surveySupported?: boolean;
  hosting?: Pick<StudioHosting, "enabled" | "domain" | "prefix">;
  efforts?: Array<{id: "low" | "medium" | "high";model:string;imageModel:string;imageQuality:string}>;
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
  promotion?: {
    active: boolean;
    startsAt: number | null;
    endsAt: number | null;
    serverNow: number;
  };
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
export function clearStudioSession(wallet: string) {
  const key = studioSessionKey(wallet);
  try { localStorage.removeItem(key); } catch { /* Storage can be unavailable. */ }
  try { sessionStorage.removeItem(key); } catch { /* Storage can be unavailable. */ }
}
export function studioSession(wallet: string) {
  const key = studioSessionKey(wallet);
  try {
    const stored = localStorage.getItem(key) ?? sessionStorage.getItem(key);
    const session = JSON.parse(stored ?? "null");
    if (session?.expiresAt > Date.now() && session?.token) {
      // Move older tab-only sessions into persistent storage so a valid login
      // survives reloads and future browser sessions until its real expiry.
      localStorage.setItem(key, JSON.stringify(session));
      sessionStorage.removeItem(key);
      return String(session.token);
    }
    clearStudioSession(wallet);
    return "";
  } catch {
    clearStudioSession(wallet);
    return "";
  }
}
export async function studioRequest<T>(
  path: string,
  token = "",
  body?: unknown,
  method?: string,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`${API_URL}/studio${path}`, {
    method: method ?? (body === undefined ? "GET" : "POST"),
    cache: "no-store",
    signal,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new StudioApiError(
      data.error ?? (path === "/config" && response.status === 404
        ? "Studio is missing on the configured backend (HTTP 404). Check VITE_API_URL and deploy the Studio backend to the matching environment."
        : `Studio returned ${response.status}`),
      response.status,
    );
  }
  return response.json();
}
export const studioConfigIsTransient = (value: StudioConfig) =>
  !value.depositsEnabled && value.depositSetup?.issues.some(issue =>
    ["aqua_mint_unavailable", "aqua_price_unavailable"].includes(issue.code));

// Keep the initial screen in a checking state while short RPC/price outages recover.
// Missing operator settings and a missing backend route are not retried here.
export async function loadStudioConfig(): Promise<StudioConfig> {
  for (let attempt=0; ; attempt++) {
    try {
      const value = await studioRequest<StudioConfig>("/config", "", undefined, undefined, AbortSignal.timeout(20000));
      if (attempt >= 2 || !studioConfigIsTransient(value)) return value;
    } catch (error) {
      if (attempt >= 2 || (error instanceof StudioApiError && error.status < 500 && error.status !== 429)) throw error;
    }
    await new Promise(resolve => setTimeout(resolve,1000 * (attempt+1)));
  }
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
export { usdCredit } from "./studio-money";
