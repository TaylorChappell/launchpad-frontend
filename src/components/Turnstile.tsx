import { useEffect,useRef,useState } from 'react';
type Widget={render:(element:HTMLElement,options:Record<string,unknown>)=>string;remove:(id:string)=>void};
declare global {interface Window {turnstile?:Widget}}
let loader:Promise<void>|null=null;
function load(){
 if(window.turnstile)return Promise.resolve();
 if(!loader)loader=new Promise<void>((resolve,reject)=>{const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;script.onload=()=>resolve();script.onerror=()=>{script.remove();loader=null;reject(new Error('CAPTCHA could not load. Please refresh.'));};document.head.appendChild(script);});
 return loader;
}
export function Turnstile({siteKey,onToken}:{siteKey:string;onToken:(token:string)=>void}){
 const element=useRef<HTMLDivElement>(null),callback=useRef(onToken);callback.current=onToken;const [error,setError]=useState('');
 useEffect(()=>{let active=true,id:string|undefined;void load().then(()=>{
  if(!active||!element.current||!window.turnstile)return;
  id=window.turnstile.render(element.current,{sitekey:siteKey,action:'auto-rewards',theme:'light',size:'flexible',callback:(token:string)=>callback.current(token),'expired-callback':()=>callback.current(''),'error-callback':()=>{callback.current('');setError('CAPTCHA could not verify. Refresh and try again.');}});
 }).catch(e=>{if(active)setError(e.message);});return()=>{active=false;if(id)window.turnstile?.remove(id);};},[siteKey]);
 return <><div className="auto-rewards-captcha" ref={element}/>{error&&<p role="alert">{error}</p>}</>;
}
