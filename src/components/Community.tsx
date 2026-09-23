import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUpRight, BarChart3, Check, ImagePlus, Loader2, Megaphone, MessageCircle, MoreHorizontal, Pin, Plus, RefreshCw, Reply, Send, ShieldCheck, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useRuntime, useWallet } from '../context';
import { savedAccountSession } from '../account-api';
import { communityApi, communityImage, communityRequest, type CommunityPage, type CommunityPost } from '../community-api';
import { creatorApi } from '../creator-api';
import type { Launch } from '../types';
import type { CommentCursor } from '../market-activity';
import { TokenMark } from './TokenCard';
import { WalletIdentity } from './WalletIdentity';
import { CommentAvatar } from './CommentAvatar';
import { CommunityMessageMenu, type MessageMenuAnchor } from './CommunityMessageMenu';
import './community.css';

type Filter='all'|'updates'|'polls'|'reports';
const merge=(a:CommunityPost[],b:CommunityPost[])=>[...new Map([...a,...b].map(p=>[p.id,p])).values()].sort((a,b)=>a.createdAt-b.createdAt||a.id.localeCompare(b.id));
export function Community({launch,onRead}:{launch:Launch;onRead?:(cursor:CommentCursor)=>void}){
  const wallet=useWallet();return <CommunityRoom key={launch.id+':'+(wallet.address??'visitor')} launch={launch} onRead={onRead}/>;
}
function CommunityRoom({launch,onRead}:{launch:Launch;onRead?:(cursor:CommentCursor)=>void}){
  const wallet=useWallet(),{config}=useRuntime(),[params]=useSearchParams();
  const creator=wallet.address===launch.creatorWallet,moderator=creator||Boolean(wallet.address&&wallet.address===config.adminWallet);
  const [session,setSession]=useState(()=>savedAccountSession(wallet.address));
  const [filter,setFilter]=useState<Filter>(params.get('feed')==='updates'?'updates':'all');
  const [posts,setPosts]=useState<CommunityPost[]>([]),[pinned,setPinned]=useState<CommunityPost|null>(null),[cursor,setCursor]=useState<string|null>(null);
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[sending,setSending]=useState(false),[actionError,setActionError]=useState(''),[notice,setNotice]=useState('');
  const [body,setBody]=useState(''),[reply,setReply]=useState<CommunityPost|null>(null),[file,setFile]=useState<File|null>(null),[preview,setPreview]=useState('');
  const [nearBottom,setNearBottom]=useState(true),[unseen,setUnseen]=useState(0);
  const [menu,setMenu]=useState<MessageMenuAnchor|null>(null),[dialog,setDialog]=useState<'update'|'poll'|'report'|'delete'|null>(null),[target,setTarget]=useState<CommunityPost|null>(null),[lightbox,setLightbox]=useState<string|null>(null);
  const [updateBody,setUpdateBody]=useState(''),updateDraft=useRef<{key:string;id:string}|null>(null);
  const [question,setQuestion]=useState(''),[options,setOptions]=useState(['','']),[hours,setHours]=useState(24),[report,setReport]=useState('Spam'),[busy,setBusy]=useState(false);
  const room=useRef<HTMLElement>(null);
  useEffect(()=>{const frame=requestAnimationFrame(()=>{const el=room.current;if(el)window.scrollTo({top:Math.max(0,window.scrollY+el.getBoundingClientRect().top-100),behavior:"instant"});});return()=>cancelAnimationFrame(frame);},[]);
  const scroll=useRef<HTMLDivElement>(null),text=useRef<HTMLTextAreaElement>(null),imageInput=useRef<HTMLInputElement>(null),alive=useRef(true),atBottom=useRef(true),read=useRef(onRead),latest=useRef<CommentCursor|null>(null);
  const postsRef=useRef(posts),retryAfter=useRef(0);postsRef.current=posts;
  const request=useRef<AbortController|null>(null),first=useRef(true),scrollMode=useRef<'bottom'|'preserve'|null>(null),oldHeight=useRef(0),busyRef=useRef(false),draft=useRef<{key:string;id:string}|null>(null),pollDraft=useRef<{key:string;id:string}|null>(null);
  read.current=onRead;
  function markRead(){if(filter==='all'&&latest.current&&document.visibilityState==='visible')read.current?.(latest.current);}
  function bottom(){atBottom.current=true;setNearBottom(true);setUnseen(0);if(scroll.current)scroll.current.scrollTop=scroll.current.scrollHeight;markRead();}
  async function load(before:string|null=null,quiet=false){
    if(request.current||(quiet&&Date.now()<retryAfter.current))return;
    const control=new AbortController();request.current=control;
    if(!quiet)setLoading(true);
    try{
      let result:CommunityPage;
      if(filter==='reports'){
        const r=await communityRequest<{posts:CommunityPost[]}>(launch.id,'reports',savedAccountSession(wallet.address)??'',{signal:control.signal});
        result={posts:r.posts,pinned:null,nextCursor:null,latest:null};
      }else result=await communityApi.list(launch.id,filter,wallet.address??'',before,control.signal);
      if(!alive.current||control.signal.aborted)return;
      latest.current=result.latest;setPinned(result.pinned);setError('');
      if(before){oldHeight.current=scroll.current?.scrollHeight??0;scrollMode.current='preserve';}
      else if(first.current||atBottom.current)scrollMode.current='bottom';
      const current=postsRef.current,initial=first.current,known=new Set(current.map(p=>p.id));
      // Reset to a contiguous page if activity has moved past all loaded messages.
      const gap=!before&&current.length>0&&result.posts.length>0&&!result.posts.some(p=>known.has(p.id));
      if(!before&&!atBottom.current&&!initial)setUnseen(n=>n+result.posts.filter(p=>!known.has(p.id)).length);
      if(initial||before||gap)setCursor(result.nextCursor);
      const oldest=result.posts.at(-1);
      const kept=before?current:current.filter(p=>oldest&&(p.createdAt<oldest.createdAt||p.createdAt===oldest.createdAt&&p.id<oldest.id));
      const updated=filter==='reports'||gap||initial?merge([],result.posts):merge(kept,result.posts);
      postsRef.current=updated;setPosts(updated);retryAfter.current=0;
      first.current=false;
    }catch(e){if(alive.current&&!control.signal.aborted){retryAfter.current=Date.now()+60000;setError(e instanceof Error?e.message:'Could not load the conversation.');}}
    finally{if(request.current===control){request.current=null;if(alive.current)setLoading(false);}}
  }
  useEffect(()=>{
    alive.current=true;first.current=true;retryAfter.current=0;setMenu(null);postsRef.current=[];latest.current=null;atBottom.current=true;setPosts([]);setCursor(null);setUnseen(0);setNearBottom(true);void load();
    const sync=()=>{setSession(savedAccountSession(wallet.address));if(document.visibilityState==='visible')void load(null,true);};
    const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void load(null,true);},10000);
    document.addEventListener('visibilitychange',sync);window.addEventListener('aqua:account-session',sync);window.addEventListener('storage',sync);
    return()=>{alive.current=false;request.current?.abort();request.current=null;window.clearInterval(timer);document.removeEventListener('visibilitychange',sync);window.removeEventListener('aqua:account-session',sync);window.removeEventListener('storage',sync);};
  },[filter,launch.id,wallet.address]);
  useLayoutEffect(()=>{
    const el=scroll.current;if(!el)return;
    if(scrollMode.current==='bottom'){el.scrollTop=el.scrollHeight;setUnseen(0);markRead();}
    else if(scrollMode.current==='preserve')el.scrollTop+=el.scrollHeight-oldHeight.current;
    scrollMode.current=null;
  },[posts]);
  useEffect(()=>{if(!file){setPreview('');return;}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url);},[file]);
  useEffect(()=>{if(text.current){text.current.style.height='auto';text.current.style.height=Math.min(text.current.scrollHeight,128)+'px';}},[body]);
  function requireSession(){const token=savedAccountSession(wallet.address);if(!token){setSession(null);setDialog(null);wallet.setModalOpen(true);return null;}return token;}
  async function send(){
    const token=requireSession();if(!token||busyRef.current||(!body.trim()&&!file)||launch.status!=='live')return;
    const key=JSON.stringify([body.trim(),reply?.id,file?.name,file?.lastModified,file?.size]);if(draft.current?.key!==key)draft.current={key,id:crypto.randomUUID()};
    const payload={id:draft.current.id,body:body.trim(),...(reply?{replyTo:reply.id}:{})};
    busyRef.current=true;setSending(true);setActionError('');
    try{
      const {post}=await communityApi.post(launch.id,token,payload,file);
      if(!alive.current)return;
      request.current?.abort();request.current=null;
      scrollMode.current='bottom';atBottom.current=true;setNearBottom(true);setPosts(p=>merge(p,[post]));setBody('');setReply(null);setFile(null);draft.current=null;
      if(filter!=='all')setFilter('all');else void load(null,true);
      text.current?.focus();
    }catch(e){if(alive.current)setActionError(e instanceof Error?e.message:'Message could not be sent. Your draft is saved here.');}
    finally{busyRef.current=false;if(alive.current)setSending(false);}
  }
  async function action(post:CommunityPost,name:string,payload:unknown){
    const token=requireSession();if(!token||busyRef.current)return false;busyRef.current=true;setBusy(true);setActionError('');
    try{const r=await communityApi.action(launch.id,post.id,name,token,payload);if(!alive.current)return false;
      if(r.post)setPosts(items=>items.map(p=>p.id===r.post!.id?r.post!:p));else{if(name==='moderate'&&(payload as any).action==='delete')setPosts(items=>items.filter(p=>p.id!==post.id));void load(null,true);}return true;
    }catch(e){if(alive.current)setActionError(e instanceof Error?e.message:'Please try again.');return false;}
    finally{busyRef.current=false;if(alive.current)setBusy(false);}
  }
  async function createPoll(){
    const token=requireSession();if(!token||busyRef.current)return;busyRef.current=true;setBusy(true);setActionError('');
    const key=JSON.stringify([question.trim(),options.map(s=>s.trim()),hours]);if(pollDraft.current?.key!==key)pollDraft.current={key,id:crypto.randomUUID()};
    try{const {post}=await communityApi.post(launch.id,token,{id:pollDraft.current.id,kind:'poll',body:question.trim(),options:options.map(s=>s.trim()),durationHours:hours},null);
      if(!alive.current)return;scrollMode.current='bottom';atBottom.current=true;setPosts(p=>merge(p,[post]));setDialog(null);setQuestion('');setOptions(['','']);pollDraft.current=null;if(filter!=='polls')setFilter('polls');else void load(null,true);
    }catch(e){if(alive.current)setActionError(e instanceof Error?e.message:'Poll could not be created.');}
    finally{busyRef.current=false;if(alive.current)setBusy(false);}
  }
  async function publishUpdate(){
    const token=requireSession();if(!token||!creator||busyRef.current||!updateBody.trim())return;
    const body=updateBody.trim();if(updateDraft.current?.key!==body)updateDraft.current={key:body,id:crypto.randomUUID()};
    busyRef.current=true;setBusy(true);setActionError('');
    try{
      const {update}=await creatorApi.publish(launch.id,token,{id:updateDraft.current.id,body});
      if(!alive.current)return;
      request.current?.abort();request.current=null;scrollMode.current='bottom';atBottom.current=true;
      setPosts(items=>merge(items,[{...update,kind:'update',imageUrl:null,reply:null,reactions:[],poll:null}]));
      setUpdateBody('');updateDraft.current=null;setDialog(null);void load(null,true);
    }catch(e){if(alive.current)setActionError(e instanceof Error?e.message:'Update could not be published.');}
    finally{busyRef.current=false;if(alive.current)setBusy(false);}
  }
  function startReply(post:CommunityPost){setMenu(null);if(!requireSession())return;setReply(post);setFilter('all');text.current?.focus({preventScroll:true});}
  useEffect(()=>{if(reply&&filter==='all')text.current?.focus({preventScroll:true});},[reply,filter]);
  function jumpTo(post:CommunityPost){const el=document.getElementById('community-'+post.id);if(el){el.scrollIntoView({block:'nearest',behavior:'smooth'});el.classList.remove('community-highlight');requestAnimationFrame(()=>el.classList.add('community-highlight'));}else{setTarget(post);setMenu(null);setLightbox(null);}}
  const currentPollVotes=(post:CommunityPost)=>post.poll?.options.reduce((sum,o)=>sum+o.votes,0)??0;
  return <section ref={room} className="community" aria-label={`${launch.name} community`}>
    <header className="community-header"><TokenMark launch={launch}/><div className="community-title"><h2>{launch.name}<span>Community</span></h2><p>Conversation, updates & a shared direction</p></div><button className="community-icon" aria-label="Refresh community" title="Refresh" disabled={loading} onClick={()=>void load()}><RefreshCw size={17} className={loading?'spin':''}/></button></header>
    <nav className="community-filters" aria-label="Community feed">{([['all','Chat',MessageCircle],['updates','Updates',Megaphone],['polls','Polls',BarChart3]] as const).map(([value,label,Icon])=><button key={value} aria-pressed={filter===value} onClick={()=>setFilter(value)}><Icon size={15}/>{label}</button>)}{moderator&&<button className="community-moderation" aria-label="Reported posts" title="Reported posts" aria-pressed={filter==='reports'} onClick={()=>setFilter('reports')}><ShieldCheck size={16}/></button>}</nav>
    {pinned&&<div className="community-pin"><Pin size={17}/><button onClick={()=>jumpTo(pinned)}><strong>Pinned message</strong><span>{pinned.body||'Picture'}</span></button>{moderator&&<button className="community-icon" aria-label="Unpin message" onClick={()=>void action(pinned,'moderate',{action:'unpin'})}><X size={15}/></button>}</div>}
    <div className="community-conversation">
      <div className="community-scroll" ref={scroll} role="region" aria-label="Community messages" tabIndex={0} onScroll={()=>{const el=scroll.current!;const near=el.scrollHeight-el.scrollTop-el.clientHeight<70;atBottom.current=near;setNearBottom(near);if(near){setUnseen(0);markRead();}}}>
        {cursor&&<button className="community-older" disabled={loading} onClick={()=>void load(cursor)}>{loading?<Loader2 size={14} className="spin"/>:null}Earlier messages</button>}
        {loading&&!posts.length?<div className="community-empty" role="status"><Loader2 className="spin"/><h3>Opening the conversation…</h3></div>:!posts.length&&!error?<div className="community-empty"><span><MessageCircle size={28}/></span><h3>{filter==='updates'?'Updates start here':filter==='polls'?'Give your community a voice':filter==='reports'?'All clear':'You’re early. Say hello.'}</h3><p>{filter==='updates'?'Project news from the creator will appear here.':filter==='polls'?'Creator polls are for community feedback.':filter==='reports'?'Reported posts will appear here for review.':`Welcome to the ${launch.symbol} community.`}</p></div>:null}
        {posts.map((post,index)=>{const own=post.authorWallet===wallet.address,day=new Date(post.createdAt).toLocaleDateString(undefined,{month:'short',day:'numeric'}),newDay=!index||new Date(posts[index-1].createdAt).toDateString()!==new Date(post.createdAt).toDateString();const total=currentPollVotes(post),ended=Boolean(post.poll&&post.poll.closesAt<=Date.now());return <div key={post.id}>
          {newDay&&<div className="community-day"><span>{day}</span></div>}
          <article id={'community-'+post.id} className={`community-message ${own?'is-own':''} is-${post.kind}`} onContextMenu={event=>{event.preventDefault();const trigger=event.currentTarget.querySelector<HTMLElement>('.community-more')!;setMenu({post,x:event.clientX,y:event.clientY,trigger});}}>
            {!own&&<CommentAvatar wallet={post.authorWallet}/>}
            <div className="community-bubble">
              <header><WalletIdentity wallet={post.authorWallet} avatar={false} explorer={false}/>{post.authorWallet===launch.creatorWallet&&<span className="community-badge">Creator</span>}{post.authorWallet===config.adminWallet&&<span className="community-badge">AQUA team</span>}{post.kind==='update'&&<span className="community-update-label"><Megaphone size={12}/>Update</span>}<button className="community-icon community-more" aria-label="Message options" aria-haspopup="menu" aria-expanded={menu?.post.id===post.id} onClick={event=>{const trigger=event.currentTarget,rect=trigger.getBoundingClientRect();setMenu(menu?.post.id===post.id?null:{post,x:rect.right,y:rect.bottom+4,trigger});}}><MoreHorizontal size={17}/></button></header>
              {post.reply&&<button className="community-reply-preview" onClick={()=>{const parent=posts.find(p=>p.id===post.reply!.id);if(parent)jumpTo(parent);else setActionError('This reply refers to an earlier message. Load earlier messages to find it.');}}><span>Reply to {post.reply.authorWallet.slice(0,4)}…{post.reply.authorWallet.slice(-4)}</span><p>{post.reply.body||'Picture'}</p></button>}
              {post.imageUrl&&<button className="community-photo" aria-label="Open picture" onClick={()=>setLightbox(communityImage(post.imageUrl!))}><img src={communityImage(post.imageUrl)} alt={post.body||'Community picture'} loading="lazy" onLoad={()=>{if(atBottom.current)bottom();}}/></button>}
              {post.body&&<MessageText text={post.body}/>}
              {post.poll&&<div className="community-poll"><small>Feedback poll · one vote per wallet</small>{post.poll.options.map((option,i)=>{const percent=total?Math.round(option.votes/total*100):0;return <button key={i} disabled={busy||ended} aria-pressed={post.poll!.myChoice===i} onClick={()=>void action(post,'vote',{choice:i})}><span className="community-poll-fill" style={{width:percent+'%'}}/><span>{post.poll!.myChoice===i?<Check size={15}/>:<span className="community-radio"/>}{option.label}</span><b>{percent}%</b></button>;})}<footer>{total} {total===1?'vote':'votes'} · {ended?'Ended':`Ends ${new Date(post.poll.closesAt).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}`}<span>No funds involved</span></footer></div>}
              {post.reports&&<div className="community-report-summary">{post.reports} reports · {post.reasons?.join(', ')}<button disabled={busy} onClick={()=>void action(post,'moderate',{action:'dismiss'})}>Dismiss reports</button></div>}
              <footer className="community-message-footer"><div className="community-reactions">{(post.reactions??[]).map(r=><button key={r.emoji} aria-label={`${r.emoji} reaction, ${r.count}`} aria-pressed={r.mine} disabled={busy} onClick={()=>void action(post,'react',{emoji:r.emoji,active:!r.mine})}>{r.emoji}<span>{r.count}</span></button>)}</div><time dateTime={new Date(post.createdAt).toISOString()} title={new Date(post.createdAt).toLocaleString()}>{new Date(post.createdAt).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'})}</time>{own&&<Check size={13} aria-label="Sent"/>}</footer>

            </div>
          </article>
        </div>;})}
        {error&&<div className="community-error" role="alert">{error}<button onClick={()=>void load()}>Try again</button></div>}
      </div>
      {!nearBottom&&<button className="community-jump" onClick={bottom}><ArrowDown size={16}/>{unseen?`${unseen} new ${unseen===1?'message':'messages'}`:'Latest messages'}</button>}
    </div>
    {(filter==='all'||(creator&&launch.status==='live'&&(filter==='updates'||filter==='polls'))||notice||(actionError&&!dialog))&&<div className="community-compose-area">
      {notice&&<p className="community-notice" role="status">{notice}<button className="community-icon" aria-label="Dismiss notice" onClick={()=>setNotice('')}><X size={14}/></button></p>}
      {actionError&&!dialog&&<p className="community-error" role="alert">{actionError}<button aria-label="Dismiss error" onClick={()=>setActionError('')}><X size={14}/></button></p>}
      {filter==='all'&&(launch.status!=='live'?<p className="community-connect">Conversation opens when this coin launches.</p>:!wallet.address||!session?<div className="community-connect"><div><strong>Join the conversation</strong><span>Connect your wallet to chat, react and vote.</span></div><button onClick={()=>wallet.setModalOpen(true)}>Connect wallet<ArrowUpRight size={16}/></button></div>:<>

        {reply&&<div className="community-composer-reply"><Reply size={17}/><div><strong>Replying to <WalletIdentity wallet={reply.authorWallet} avatar={false} explorer={false}/></strong><p>{reply.body||'Picture'}</p></div><button className="community-icon" aria-label="Cancel reply" onClick={()=>setReply(null)}><X size={16}/></button></div>}
        {preview&&<div className="community-attachment"><img src={preview} alt="Picture ready to send"/><div><strong>Picture ready</strong><span>Optimized when you send</span></div><button className="community-icon" aria-label="Remove picture" disabled={sending} onClick={()=>setFile(null)}><X size={16}/></button></div>}
        <form className="community-composer" onSubmit={e=>{e.preventDefault();void send();}}><input ref={imageInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" aria-label="Attach a picture" hidden onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(!f)return;if(f.size>5*1024*1024){setActionError('Choose a picture smaller than 5 MB.');return;}setFile(f);setActionError('');}}/>
          <button type="button" className="community-icon" aria-label="Add picture" title="Add picture" disabled={sending} onClick={()=>imageInput.current?.click()}><ImagePlus size={21}/></button>
          <textarea ref={text} aria-label="Your message" rows={1} maxLength={1000} placeholder={reply?'Write a reply…':'Message the community…'} disabled={sending} value={body} onChange={e=>setBody(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing&&(e.ctrlKey||e.metaKey||window.matchMedia('(pointer:fine)').matches)){e.preventDefault();void send();}}}/>
          <button className="community-send" type="submit" disabled={sending||(!body.trim()&&!file)} aria-label="Send message" title="Send message">{sending?<Loader2 size={19} className="spin"/>:<Send size={19}/>}</button>
        </form>{body.length>850&&<span className="community-count">{body.length}/1,000</span>}
      </>)}
      {filter!=='all'&&creator&&launch.status==='live'&&(filter==='updates'||filter==='polls')&&<div className="community-feed-actions"><button onClick={()=>{if(!requireSession())return;setActionError('');setDialog(filter==='updates'?'update':'poll');}}><Plus size={16}/>{filter==='updates'?'Create update':'Create poll'}</button></div>}
    </div>}
    {menu&&<CommunityMessageMenu key={menu.post.id} anchor={menu} moderator={moderator} canDelete={moderator||menu.post.authorWallet===wallet.address} busy={busy}
      onClose={()=>setMenu(null)} onReply={()=>startReply(menu.post)}
      onReact={emoji=>{void action(menu.post,'react',{emoji,active:!menu.post.reactions?.find(r=>r.emoji===emoji)?.mine});setMenu(null);}}
      onPin={()=>{void action(menu.post,'moderate',{action:'pin'});setMenu(null);}}
      onReport={()=>{setTarget(menu.post);setDialog('report');setMenu(null);}}
      onDelete={()=>{setTarget(menu.post);setDialog('delete');setMenu(null);}}/>}
    {dialog&&<CommunityDialog title={dialog==='update'?'Create update':dialog==='poll'?'Ask your community':dialog==='delete'?'Delete this message?':'Report this message'} onClose={()=>{if(!busy){setDialog(null);setTarget(null);setActionError('');}}}>
      {dialog==='update'?<form onSubmit={event=>{event.preventDefault();void publishUpdate();}}><label>Project update<textarea autoFocus maxLength={1000} required value={updateBody} onChange={event=>setUpdateBody(event.target.value)} placeholder="Share a project update…" disabled={busy}/></label>{updateBody.length>850&&<span className="community-count">{updateBody.length}/1,000</span>}<button className="community-submit" disabled={busy||!updateBody.trim()}>{busy?'Publishing…':'Publish update'}</button></form>:dialog==='poll'?<form onSubmit={e=>{e.preventDefault();void createPoll();}}><p className="community-dialog-hint">A quick way to hear from your holders. This poll does not control funds.</p><label>Question<textarea maxLength={1000} required value={question} onChange={e=>setQuestion(e.target.value)} placeholder="What should we focus on next?"/></label><fieldset><legend>Options</legend>{options.map((option,i)=><div className="community-poll-option" key={i}><input aria-label={`Option ${i+1}`} required maxLength={80} value={option} placeholder={`Option ${i+1}`} onChange={e=>setOptions(options.map((o,j)=>i===j?e.target.value:o))}/>{options.length>2&&<button type="button" className="community-icon" aria-label={`Remove option ${i+1}`} onClick={()=>setOptions(options.filter((_,j)=>j!==i))}><X size={15}/></button>}</div>)}{options.length<4&&<button type="button" className="community-add-option" onClick={()=>setOptions([...options,''])}><Plus size={14}/>Add option</button>}</fieldset><label>Voting stays open<select value={hours} onChange={e=>setHours(Number(e.target.value))}><option value={1}>1 hour</option><option value={6}>6 hours</option><option value={24}>24 hours</option></select></label><button className="community-submit" disabled={busy||!question.trim()||options.some(o=>!o.trim())}>{busy?'Creating…':'Create poll'}</button></form>:dialog==='report'?<><p className="community-dialog-hint">The creator and AQUA team can review your report.</p><label>Reason<select value={report} onChange={e=>setReport(e.target.value)}>{['Spam','Abuse','Scam'].map(s=><option key={s}>{s}</option>)}</select></label><button className="community-submit" disabled={busy} onClick={async()=>{if(target&&await action(target,'report',{reason:report})){setDialog(null);setTarget(null);setNotice('Report sent for review.');}}}>{busy?'Sending…':'Send report'}</button></>:<><p className="community-dialog-hint">This removes the message and its picture from the community.</p><button className="community-submit community-delete" disabled={busy} onClick={async()=>{if(target&&await action(target,'moderate',{action:'delete'})){setDialog(null);setTarget(null);}}}>{busy?'Deleting…':'Delete message'}</button></>}
      {actionError&&<p className="community-error" role="alert">{actionError}</p>}
    </CommunityDialog>}
    {lightbox&&<CommunityDialog title="Community picture" onClose={()=>setLightbox(null)} wide><img className="community-lightbox" src={lightbox} alt="Expanded community picture"/></CommunityDialog>}
    {target&&!dialog&&!lightbox&&<CommunityDialog title={target.kind==='update'?'Project update':'Pinned message'} onClose={()=>setTarget(null)}><MessageText text={target.body}/>{target.imageUrl&&<img className="community-lightbox" src={communityImage(target.imageUrl)} alt="Pinned picture"/>}</CommunityDialog>}
  </section>;
}
function MessageText({text}:{text:string}){const [expanded,setExpanded]=useState(false),long=text.length>450||text.split('\n').length>8;return <><p className="community-text">{long&&!expanded?text.slice(0,450).split('\n').slice(0,8).join('\n')+'…':text}</p>{long&&<button className="community-expand" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>{expanded?'Show less':'Read more'}</button>}</>;}
function CommunityDialog({title,onClose,children,wide=false}:{title:string;onClose:()=>void;children:ReactNode;wide?:boolean}){
  const ref=useRef<HTMLDialogElement>(null);useEffect(()=>{ref.current?.showModal();return()=>ref.current?.close();},[]);
  return <dialog ref={ref} className={'community-dialog'+(wide?' is-wide':'')} aria-label={title} onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}><header><h3>{title}</h3><button className="community-icon" aria-label="Close" onClick={onClose}><X size={20}/></button></header>{children}</dialog>;
}
