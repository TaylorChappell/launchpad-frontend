const dismissed=new Set<string>();
function key(scope:string,id:string){return `aqua:launch-resume-hidden:${scope}:${id}`;}
export function isLaunchResumeDismissed(scope:string,id:string){
  const value=key(scope,id);
  if(dismissed.has(value))return true;
  try{return localStorage.getItem(value)==='1';}catch{return false;}
}
export function dismissLaunchResume(scope:string,id:string){
  const value=key(scope,id);dismissed.add(value);
  try{localStorage.setItem(value,'1');}catch{/* Keep the dismissal for this session when storage is unavailable. */}
}
