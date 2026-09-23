import { useEffect, useRef, useState } from 'react';
import { communityApi, type CommunityPost } from '../community-api';

type Outgoing={post:CommunityPost;payload:unknown;file:File|null;status:'pending'|'sent'|'failed';error?:string;url?:string};
type ReactionState={base:CommunityPost['reactions'];desired:Map<string,boolean>;running:boolean;settledAt:number};
function applyReactions(state:ReactionState){
  const result=state.base.map(r=>({...r}));
  for(const [emoji,active] of state.desired){
    const current=result.find(r=>r.emoji===emoji);
    if(current){current.count=Math.max(0,current.count+Number(active)-Number(current.mine));current.mine=active;}
    else if(active)result.push({emoji,count:1,mine:true});
  }
  return result.filter(r=>r.count>0);
}
// Keep transient UI state separate from polled server pages. A stale refresh must not erase a send or undo a tap.
export function useCommunityDelivery(launchId:string){
  const messages=useRef(new Map<string,Outgoing>()),reactions=useRef(new Map<string,ReactionState>()),pulses=useRef(new Map<string,number>());
  const urls=useRef(new Set<string>()),mounted=useRef(true),revision=useRef(0);
  const [render,setRender]=useState(0),[reactionError,setReactionError]=useState('');
  const changed=()=>{revision.current++;if(mounted.current)setRender(n=>n+1);};
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;for(const url of urls.current)URL.revokeObjectURL(url);urls.current.clear();};},[]);
  // Release previews after React has switched to the confirmed server image.
  useEffect(()=>{const live=new Set([...messages.current.values()].map(m=>m.url));for(const url of urls.current)if(!live.has(url)){URL.revokeObjectURL(url);urls.current.delete(url);}},[render]);
  async function deliver(item:Outgoing,token:string){
    item.status='pending';item.error=undefined;changed();
    try{
      const {post}=await communityApi.post(launchId,token,item.payload,item.file);
      if(!mounted.current||messages.current.get(post.id)!==item)return;
      item.post=post;item.status='sent';item.file=null;changed();
    }catch(error){
      if(!mounted.current||messages.current.get(item.post.id)!==item)return;
      item.status='failed';item.error=error instanceof Error?error.message:'Message could not be sent.';changed();
    }
  }
  function send(post:CommunityPost,payload:unknown,file:File|null,token:string){
    const url=file?URL.createObjectURL(file):undefined;if(url)urls.current.add(url);
    const item:Outgoing={post:{...post,imageUrl:url??null},payload,file,url,status:'pending'};
    messages.current.set(post.id,item);void deliver(item,token);
  }
  function retry(id:string,token:string){const item=messages.current.get(id);if(item?.status==='failed')void deliver(item,token);}
  function observe(posts:CommunityPost[],startedAt:number){
    let dirty=false;
    for(const post of posts){
      // The read is also proof of acceptance when a POST response was lost.
      if(messages.current.delete(post.id))dirty=true;
      const state=reactions.current.get(post.id);
      if(state&&!state.running&&!state.desired.size&&startedAt>=state.settledAt){reactions.current.delete(post.id);dirty=true;}
    }
    if(dirty)changed();
  }
  async function flush(id:string,state:ReactionState,token:string){
    if(state.running)return;state.running=true;
    try{
      while(state.desired.size&&mounted.current){
        const [emoji,active]=state.desired.entries().next().value!;
        const result=await communityApi.action(launchId,id,'react',token,{emoji,active});
        if(!mounted.current)return;
        if(!result.post)throw new Error('Reaction could not be saved. Please try again.');
        state.base=result.post.reactions;
        if(state.desired.get(emoji)===active)state.desired.delete(emoji);
        changed();
      }
    }catch(error){
      // Restore the last confirmed counts. Do not silently keep retrying an expired session or a rate limit.
      state.desired.clear();if(mounted.current)setReactionError(error instanceof Error?error.message:'Reaction could not be saved. Please try again.');
    }finally{state.running=false;changed();state.settledAt=revision.current;}
  }
  function react(post:CommunityPost,emoji:string,token:string){
    let state=reactions.current.get(post.id);
    if(!state){state={base:post.reactions.map(r=>({...r})),desired:new Map(),running:false,settledAt:0};reactions.current.set(post.id,state);}
    const active=!applyReactions(state).find(r=>r.emoji===emoji)?.mine;
    state.desired.set(emoji,active);pulses.current.set(post.id+emoji,(pulses.current.get(post.id+emoji)??0)+1);setReactionError('');changed();void flush(post.id,state,token);
  }
  function decorate(post:CommunityPost){const state=reactions.current.get(post.id);return state?{...post,reactions:applyReactions(state)}:post;}
  return {send,retry,react,observe,decorate,forget:(id:string)=>{messages.current.delete(id);reactions.current.delete(id);changed();},version:()=>revision.current,localPosts:[...messages.current.values()].map(m=>m.post),
    status:(id:string)=>messages.current.get(id)?.status,error:(id:string)=>messages.current.get(id)?.error,
    pulse:(id:string,emoji:string)=>pulses.current.get(id+emoji)??0,reactionError,clearReactionError:()=>setReactionError('')};
}
