import { useState } from "react";
export function useWatchlist() {
  const [ids,setIds]=useState<string[]>(()=>{try{const value=JSON.parse(localStorage.getItem("aqua:watchlist:v1")??"[]");return Array.isArray(value)?value.filter(x=>typeof x==="string").slice(0,200):[];}catch{return [];}});
  function toggle(id:string){setIds(current=>{const next=current.includes(id)?current.filter(x=>x!==id):[...current,id].slice(-200);try{localStorage.setItem("aqua:watchlist:v1",JSON.stringify(next));}catch{}return next;});}
  return {ids,toggle};
}
