import type { ReactNode } from 'react';
// Only two formatting tokens. React escapes every text segment; HTML is never executed.
export function UpdateText({text,styled=false}:{text:string;styled?:boolean}){
  function format(value:string,depth=0):ReactNode{
    if(!styled||depth>1)return value;
    return value.split(/(\*\*[\s\S]+?\*\*|__[\s\S]+?__)/g).map((part,index)=>part.startsWith('**')&&part.endsWith('**')?<strong key={index}>{format(part.slice(2,-2),depth+1)}</strong>:part.startsWith('__')&&part.endsWith('__')?<u key={index}>{format(part.slice(2,-2),depth+1)}</u>:part);
  }
  return <p className="community-text community-update-text">{format(text)}</p>;
}
