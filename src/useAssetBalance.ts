import { useEffect, useState } from "react";
import { useRuntime, useWallet } from "./context";

export function useAssetBalance(mint: string | null, refresh: number) {
  const {config,loading}=useRuntime(), {address}=useWallet();
  const key=[address,mint,config.publicRpcUrl].join(":");
  const [balance,setBalance]=useState<{key:string;raw:string}|null>(null);
  useEffect(()=>{
    let active=true,pending=false;
    setBalance(null);
    if(!address || loading) return;
    const load=async()=>{
      if(pending || document.visibilityState==="hidden")return;
      pending=true;
      try {
        const {Connection,PublicKey}=await import("@solana/web3.js");
        const connection=new Connection(config.publicRpcUrl,{commitment:"confirmed",fetch:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(10_000)})});
        const owner=new PublicKey(address);
        const value=mint ? (await connection.getParsedTokenAccountsByOwner(owner,{mint:new PublicKey(mint)})).value.reduce((sum,a)=>sum+BigInt(a.account.data.parsed.info.tokenAmount.amount),0n).toString() : String(await connection.getBalance(owner));
        if(active)setBalance({key,raw:value});
      }catch{if(active)setBalance(null);}finally{pending=false;}
    };
    void load();const timer=window.setInterval(()=>void load(),15_000);window.addEventListener("focus",load);
    return()=>{active=false;window.clearInterval(timer);window.removeEventListener("focus",load);};
  },[address,mint,refresh,config.publicRpcUrl,loading]);
  return balance?.key===key?balance.raw:null;
}
