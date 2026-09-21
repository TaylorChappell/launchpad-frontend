import { useId } from "react";
export function SolAmount({value}:{value:string}){
  const id=useId();
  return <span className="sol-amount" aria-label={value+" SOL"}><svg viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id={id} x1="0" y1="1" x2="1" y2="0"><stop stopColor="#9945ff"/><stop offset=".52" stopColor="#19fb9b"/><stop offset="1" stopColor="#00d1ff"/></linearGradient></defs><path fill={`url(#${id})`} d="M8 6h19l-3 4H5l3-4Zm-3 9h19l3 4H8l-3-4Zm3 9h19l-3 4H5l3-4Z"/></svg>{value}</span>;
}
