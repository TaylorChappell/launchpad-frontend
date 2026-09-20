import type { StudioFile } from "./studio-api";
import { studioPreviewTarget } from "./studio-preview-paths";
export function studioQuality(files:StudioFile[]){
  const issues:string[]=[];
  for(const file of files.filter(f=>f.encoding==="utf8"&&/\.html?$/i.test(f.path))){
    const doc=new DOMParser().parseFromString(file.content,"text/html");
    if(!doc.querySelector('meta[name="viewport"]'))issues.push(file.path+": missing mobile viewport.");
    for(const link of doc.querySelectorAll<HTMLAnchorElement>("a[href]")){
      const href=link.getAttribute("href")??"";
      if(!href||href==="#"){issues.push(file.path+": placeholder link.");continue;}
      if(/^(https?:|mailto:|tel:|data:|blob:|\/\/)/i.test(href))continue;
      const target=studioPreviewTarget(files,href,file.path);
      if(!target)issues.push(file.path+": missing page "+href);
      else if(target.hash){
        const page=files.find(f=>f.path===target.path);
        const targetDoc=page?new DOMParser().parseFromString(page.content,"text/html"):null;
        let id=target.hash.slice(1);try{id=decodeURIComponent(id);}catch{}
        if(targetDoc&&!targetDoc.getElementById(id)&&!targetDoc.getElementsByName(id).length)issues.push(file.path+": missing section "+href);
      }
    }
    if(doc.querySelector("form")&&!files.some(f=>/\.m?js$/.test(f.path))&&!doc.querySelector("script"))issues.push(file.path+": form behavior needs a handler or a deployed backend.");
  }
  return [...new Set(issues)].slice(0,50);
}
