// Local-only drafts. Never store wallet secrets or signed transactions here.
async function database(){
  return new Promise<IDBDatabase>((resolve,reject)=>{
    const request=indexedDB.open("aqua-launch-drafts",1);
    request.onupgradeneeded=()=>request.result.createObjectStore("drafts");
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  });
}
export async function readLaunchDraft<T>(key:string):Promise<T|null>{
  const db=await database();
  try{return await new Promise<T|null>((resolve,reject)=>{const r=db.transaction("drafts").objectStore("drafts").get(key);r.onsuccess=()=>resolve(r.result??null);r.onerror=()=>reject(r.error);});}finally{db.close();}
}
export async function saveLaunchDraft(key:string,value:unknown){
  const db=await database();
  try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction("drafts","readwrite");tx.objectStore("drafts").put(value,key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}finally{db.close();}
}
