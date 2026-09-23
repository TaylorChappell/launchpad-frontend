import type { StudioJob, StudioState } from "./studio-api";

const fieldLabels: Record<string,string> = {
  name:"Coin name", symbol:"Ticker", description:"Description", stockMint:"Reward pair",
  rewardMode:"Reward mode", imagePath:"Coin artwork", xUrl:"X link", websiteUrl:"Website link",
  telegramUrl:"Telegram link", dexFundingEnabled:"DEX funding", dexProfile:"DEX profile",
};
/** List actual, unlocked changes, not claims from the model's prose. */
export function studioChangeList(state: StudioState, result: StudioJob["result"]) {
  const changes: Array<{key:string;label:string;detail:string}> = [];
  if (!result) return changes;
  for (const [key,value] of Object.entries(result.frontendVariables ?? {})) {
    if (state.frontendVariables?.[key] !== value)
      changes.push({key:"variable:"+key,label:"Set frontend variable",detail:key+" = "+(value || "(empty)")});
  }
  if (result.autoFillCA !== undefined && result.autoFillCA !== state.autoFillCA)
    changes.push({key:"autoFillCA",label:result.autoFillCA ? "Enable automatic website CA" : "Disable automatic website CA",detail:result.autoFillCA ? "Fill connected CA fields and trading links after this project's coin launches." : "Keep the website's manual CA and trading links."});
  for (const [key,value] of Object.entries(result.launch ?? {})) {
    if (state.lockedFields.includes(key as keyof StudioState["launch"]) || JSON.stringify(state.launch[key as keyof StudioState["launch"]]) === JSON.stringify(value)) continue;
    changes.push({key:"launch:"+key,label:"Update "+(fieldLabels[key] ?? key),detail:typeof value === "object" ? JSON.stringify(value) : String(value || "Clear this value")});
  }
  for (const file of result.files) {
    const old = state.files.find(item=>item.path===file.path);
    if (old?.locked || (old?.content===file.content && old.encoding===file.encoding)) continue;
    changes.push({key:"file:"+file.path,label:old ? "Update file" : "Add file",detail:file.path});
  }
  for (const path of result.deletePaths) {
    const old = state.files.find(item=>item.path===path);
    if (old && !old.locked && !result.files.some(file=>file.path===path))
      changes.push({key:"delete:"+path,label:"Delete file",detail:path});
  }
  return changes;
}
