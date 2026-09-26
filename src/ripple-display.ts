const dollars = new Intl.NumberFormat("en-US", { style:"currency", currency:"USD", minimumFractionDigits:2, maximumFractionDigits:2 });
export function rippleDollars(cents: string | null | undefined, lamports?: string) {
  if (cents == null && lamports !== "0") return "—";
  const amount=Number(cents ?? 0)/100;
  return Number.isFinite(amount) ? dollars.format(amount) : "—";
}
