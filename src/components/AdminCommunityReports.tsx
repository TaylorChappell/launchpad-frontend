import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { api } from '../api';
import { communityImage, type CommunityPost } from '../community-api';
import { WalletIdentity } from './WalletIdentity';
import { UpdateText } from './UpdateText';
import './community.css';

export function AdminCommunityReports({token,search}:{token:string;search:string}){
  const [posts,setPosts]=useState<CommunityPost[]>([]),[offset,setOffset]=useState(0),[more,setMore]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[target,setTarget]=useState<string|null>(null);
  async function load(){setBusy(true);setError('');try{const result=await api.adminCommunityReports(token,offset);setPosts(result.posts);setMore(result.hasMore);}catch(e){setError(e instanceof Error?e.message:'Could not load reports.');}finally{setBusy(false);}}
  useEffect(()=>{let active=true;setBusy(true);setError('');api.adminCommunityReports(token,offset).then(result=>{if(active){setPosts(result.posts);setMore(result.hasMore);}},e=>{if(active)setError(e.message);}).finally(()=>{if(active)setBusy(false);});return()=>{active=false;};},[token,offset]);
  async function act(post:CommunityPost,action:'delete'|'dismiss'){
    setBusy(true);setError('');try{await api.adminModerateCommunity(token,post.launchId,post.id,action);setTarget(null);await load();}catch(e){setError(e instanceof Error?e.message:'Could not moderate this post.');}finally{setBusy(false);}
  }
  const visible=posts.filter(post=>`${post.launchId} ${post.body} ${post.authorWallet}`.toLowerCase().includes(search.toLowerCase()));
  return <section className="ops-panel"><header className="ops-community-heading"><div><h2>Community reports</h2><p>Private to AQUA admins. New reports also go to the operations Discord webhook.</p></div><button disabled={busy} onClick={()=>void load()} aria-label="Refresh reports"><RefreshCw size={16}/></button></header>
    {error&&<p className="ops-error" role="alert">{error}</p>}
    {busy&&!posts.length?<div className="ops-empty" role="status">Loading reports…</div>:!visible.length?<div className="ops-empty"><ShieldCheck size={22}/><p>No reports in this view.</p></div>:<div className="ops-community-reports">{visible.map(post=><article key={post.id}>
      <header><Link to={`/token/${post.launchId}?tab=community&feed=${post.kind==='update'?'updates':post.kind==='poll'?'polls':'all'}`}>{post.launchId}</Link><span>{post.reports} reports · {post.reasons?.join(', ')}</span></header>
      <WalletIdentity wallet={post.authorWallet}/><UpdateText text={post.body} styled={post.bodyFormat==='styled'}/>
      {post.poll&&<div><small>{post.poll.holdersOnly?'Holders only · 0.1% minimum':'Open poll'}</small><ol>{post.poll.options.map((option,index)=><li key={index}>{option.label}</li>)}</ol></div>}{post.imageUrl&&<a href={communityImage(post.imageUrl)} target="_blank" rel="noreferrer"><img src={communityImage(post.imageUrl)} alt="Reported attachment"/></a>}
      <footer>{target===post.id?<><span>Delete this post permanently?</span><button disabled={busy} onClick={()=>void act(post,'delete')}>Confirm delete</button><button disabled={busy} onClick={()=>setTarget(null)}>Cancel</button></>:<><button disabled={busy} onClick={()=>void act(post,'dismiss')}>Dismiss reports</button><button disabled={busy} onClick={()=>setTarget(post.id)}><Trash2 size={14}/>Delete post</button></>}</footer>
    </article>)}</div>}
    <footer className="ops-pager"><span>Page {offset/50+1} · up to 50 reports per page</span><div><button disabled={busy||offset===0} onClick={()=>setOffset(value=>Math.max(0,value-50))}>Previous</button><button disabled={busy||!more} onClick={()=>setOffset(value=>value+50)}>Next</button></div></footer>
  </section>;
}
