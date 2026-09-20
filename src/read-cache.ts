const cache=new Map<string,{until:number;value:unknown}>();
const inflight=new Map<string,Promise<unknown>>();
export async function cachedRead<T>(key:string,read:()=>Promise<T>,ttl=2000):Promise<T>{
  const hit=cache.get(key);if(hit&&hit.until>Date.now())return hit.value as T;
  const pending=inflight.get(key);if(pending)return pending as Promise<T>;
  const generation=cacheGeneration;
  const request=read().then(value=>{if(generation===cacheGeneration){cache.set(key,{value,until:Date.now()+ttl});if(cache.size>200)cache.delete(cache.keys().next().value!);}return value;}).finally(()=>{if(inflight.get(key)===request)inflight.delete(key);});
  inflight.set(key,request);return request;
}
let cacheGeneration=0;
export function clearReadCache(){cacheGeneration++;cache.clear();inflight.clear();}
