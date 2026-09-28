// Shared market links always open the public AQUA market page.
export function marketShareUrl(id: string) {
  return "https://aquafamily.fun/#/token/" + encodeURIComponent(id) + "?tab=transactions";
}
