import { API_URL, ApiError } from './api';
import { studioSessionKey } from './studio-api';
export type CommunityPost = {
  id:string; launchId:string; authorWallet:string; body:string; createdAt:number; kind:'message'|'update'|'poll'; imageUrl:string|null;
  reply:{id:string;authorWallet:string;body:string}|null; reactions:{emoji:string;count:number;mine:boolean}[];
  poll:{options:{label:string;votes:number}[];myChoice:number|null;closesAt:number}|null; reasons?:string[];reports?:number;
};
export type CommunityPage={posts:CommunityPost[];pinned:CommunityPost|null;nextCursor:string|null;latest:{id:string;createdAt:number}|null};
export async function communityRequest<T>(id:string,path='',token='',init:RequestInit={}):Promise<T>{
  const response=await fetch(`${API_URL}/api/launches/${encodeURIComponent(id)}/${path.startsWith('reports')?'community-reports'+path.slice(7):'community'+path}`,{
    ...init,cache:'no-store',signal:init.signal?AbortSignal.any([init.signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000),
    headers:{...(token?{Authorization:`Bearer ${token}`} : {}),...init.headers},
  });
  const result=await response.json().catch(()=>({}));
  if(response.status===401&&token){
    try{for(const key of Object.keys(localStorage)){if(key.startsWith(studioSessionKey(''))&&JSON.parse(localStorage.getItem(key)??'null')?.token===token)localStorage.removeItem(key);}}catch{/* Reconnect if storage is unavailable. */}
    window.dispatchEvent(new Event('aqua:account-session'));
  }
  if(!response.ok)throw new ApiError(result.error??'Community could not load. Please try again.',response.status,result);
  return result;
}
export const communityApi={
  list:(id:string,filter:string,viewer:string,cursor:string|null,signal?:AbortSignal)=>communityRequest<CommunityPage>(id,`?${new URLSearchParams({filter,viewer,...(cursor?{cursor}:{})})}`,'',{signal}),
  post:(id:string,token:string,post:unknown,image:File|null)=>{
    if(image){const data=new FormData();data.append('post',JSON.stringify(post));data.append('image',image);return communityRequest<{post:CommunityPost}>(id,'',token,{method:'POST',body:data});}
    return communityRequest<{post:CommunityPost}>(id,'',token,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(post)});
  },
  action:(id:string,post:string,action:string,token:string,body:unknown)=>communityRequest<{post?:CommunityPost}>(id,`/${post}/${action}`,token,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),
};
export const communityImage=(path:string)=>path.startsWith('/api/')?API_URL+path:path;
