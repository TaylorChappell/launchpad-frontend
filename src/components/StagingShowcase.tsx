import {useEffect,useState} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import {ArrowUpRight} from 'lucide-react';
import {api} from '../api';
import {useRuntime} from '../context';
import type {Launch} from '../types';
import {TokenMark} from './TokenCard';
import './staging-showcase.css';
function useShowcase(){
 const {config}=useRuntime();const [coins,setCoins]=useState<Launch[]>([]),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{if(!config.stagingShowcaseEnabled){setCoins([]);return;}const abort=new AbortController();setError('');api.showcase(abort.signal).then(r=>{if(!abort.signal.aborted)setCoins(r.enabled?r.launches:[]);}).catch(()=>{if(!abort.signal.aborted)setError('Preview coins could not load.');});return()=>abort.abort();},[config.stagingShowcaseEnabled,retry]);
 return {coins,error,retry:()=>setRetry(n=>n+1),enabled:config.stagingShowcaseEnabled};
}
export function StagingShowcase(){
 const {coins,error,retry,enabled}=useShowcase(),[all,setAll]=useState(false);if(!enabled)return null;
 return <section className="showcase-catalog" aria-label="Staging feature showcase"><header><div><span className="showcase-label">STAGING PREVIEW</span><h2>Explore every feature.</h2><p>Sample coins using the real interface. No transactions or live votes.</p></div></header>
 {error?<p role="alert">{error} <button onClick={retry}>Retry</button></p>:!coins.length?<p role="status">Loading previews…</p>:<div className="showcase-grid">{coins.slice(0,all?coins.length:6).map(coin=><Link key={coin.id} to={`/token/${coin.id}?tab=${coin.showcase!.tab.toLowerCase()}`}><TokenMark launch={coin}/><span><b>{coin.name}</b><small>{coin.showcase!.feature}</small></span><ArrowUpRight size={16}/></Link>)}</div>}
 {coins.length>6&&<button className="showcase-more" onClick={()=>setAll(v=>!v)}>{all?'Show fewer previews':`Show all ${coins.length} previews`}</button>}
 </section>;
}
export function ShowcaseBanner({launch}:{launch:Launch}){
 const {coins}=useShowcase(),navigate=useNavigate();
 return <aside className="showcase-banner" aria-label="Staging preview"><div><b>Staging preview</b><span>{launch.showcase?.feature} · Sample data, read-only.</span></div><label><span className="sr-only">Preview scenario</span><select value={launch.id} onChange={e=>{const coin=coins.find(c=>c.id===e.target.value);if(coin)navigate(`/token/${coin.id}?tab=${coin.showcase!.tab.toLowerCase()}`);}}>{(coins.length?coins:[launch]).map(c=><option key={c.id} value={c.id}>{c.name} · {c.showcase?.feature}</option>)}</select></label></aside>;
}
