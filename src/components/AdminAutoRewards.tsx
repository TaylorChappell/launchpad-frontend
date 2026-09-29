import { useEffect,useState } from 'react';
import { autoRewardsApi } from '../auto-rewards-api';
import { AutoRewardsActivity } from './AutoRewardsActivity';
import { WalletIdentity } from './WalletIdentity';
export function AdminAutoRewards({token}:{token:string}){
 const [wallet,setWallet]=useState(''),[data,setData]=useState<Awaited<ReturnType<typeof autoRewardsApi.wallets>>|null>(null),[offset,setOffset]=useState(0),[revision,setRevision]=useState(0),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{let active=true;autoRewardsApi.wallets(token,'',offset).then(d=>{if(active)setData(d);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[token,offset,revision]);
 async function change(address:string,enabled:boolean){setBusy(true);setError('');try{await autoRewardsApi.adminSet(token,address.trim(),enabled);setRevision(n=>n+1);setWallet('');}catch(e){setError(e instanceof Error?e.message:'Could not update wallet.');}finally{setBusy(false);}}
 return <><section className="ops-panel auto-rewards-admin"><header><h2>Auto rewards wallets</h2><p>New holder rewards only. Enabling an existing opt-in keeps its original cutoff.</p></header>
  <form onSubmit={e=>{e.preventDefault();void change(wallet,true);}}><label htmlFor="admin-auto-wallet">Wallet address</label><input id="admin-auto-wallet" value={wallet} onChange={e=>setWallet(e.target.value)} autoComplete="off" spellCheck={false}/><button className="primary" disabled={busy||!wallet.trim()}>Enable auto rewards</button></form>
  {error&&<p role="alert" className="danger-note">{error}</p>}<div className="table-scroll"><table className="market-table"><thead><tr><th>Wallet</th><th>New rewards from</th><th>Source</th><th>Auto rewards</th></tr></thead><tbody>{data?.wallets.map(w=><tr key={w.wallet}><td><WalletIdentity wallet={w.wallet}/></td><td>{new Date(Number(w.enabled_at)).toLocaleString()}</td><td>{w.source}</td><td><button className="soft-button" disabled={busy} onClick={()=>void change(w.wallet,!w.enabled)}>{w.enabled?'Disable':'Enable'}</button></td></tr>)}</tbody></table></div>
  <div className="auto-rewards-pages"><button className="soft-button" disabled={!offset} onClick={()=>setOffset(n=>n-50)}>Previous</button><span>Page {offset/50+1}</span><button className="soft-button" disabled={!data?.hasMore} onClick={()=>setOffset(n=>n+50)}>Next</button></div></section><AutoRewardsActivity token={token}/></>;
}
