import { API_URL } from './api';
import { accountRequest, ensureAccountSession } from './account-api';
import { xReturnPath } from './x-link-state';

export const githubIdentityPendingKey=`aqua:redirect-github:${API_URL}`;
export type GithubIdentityPending={state:string;wallet:string;market?:string|null;returnTo?:string};
export async function connectGithubIdentity(address:string,sign:(message:string)=>Promise<{signature:string}>,isCurrent:()=>boolean){
  const token=await ensureAccountSession(address,sign,isCurrent);
  if(!isCurrent())throw new Error('Wallet changed. Connect GitHub again.');
  const result=await accountRequest<{url:string;state:string}>('/integrations/github/connect',token,{purpose:'redirect'});
  if(!isCurrent())throw new Error('Wallet changed. Connect GitHub again.');
  sessionStorage.setItem(githubIdentityPendingKey,JSON.stringify({state:result.state,wallet:address,returnTo:'#'+xReturnPath(window.location.hash)}));
  window.location.assign(result.url);
}
