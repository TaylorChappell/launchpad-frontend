import {API_URL} from "./api";
// Set VITE_SHARE_ORIGIN only after /token/* is routed to the backend share handler.
export function marketShareUrl(id:string){
  const origin=import.meta.env.VITE_SHARE_ORIGIN;
  return typeof origin==="string"&&/^https:\/\//.test(origin)
    ? origin.replace(/\/$/,"")+"/token/"+encodeURIComponent(id)
    : API_URL+"/share/token/"+encodeURIComponent(id);
}
