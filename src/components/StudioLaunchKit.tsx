import { useMemo } from "react";
import { Copy, Download, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { studioAssetUrl, type StudioFile } from "../studio-api";
type Post={stage:string;text:string;imagePath:string;alt:string};
export function StudioLaunchKit({files}:{files:StudioFile[]}){
  const posts=useMemo(()=>{try{const value=JSON.parse(files.find(f=>f.path==="frontend/launch-kit/posts.json")?.content??"{}");return Array.isArray(value.posts)?value.posts.filter((p:Post)=>p&&typeof p.text==="string"&&p.text.length<=1000).slice(0,5) as Post[]:[];}catch{return [];}},[files]);
  if(!posts.length)return null;
  return <section className="at-launch-kit"><h3>Your X launch posts</h3>{posts.map((post,i)=>{
    const image=files.find(file=>file.path===post.imagePath&&file.encoding==="base64");
    return <article key={i}><small>{({teaser:"Before launch",launch:"Launch day",follow_up:"After launch"} as Record<string,string>)[post.stage]??"Draft"}</small><p>{post.text}</p>{image&&<img src={studioAssetUrl(image)} alt={post.alt||"Post artwork"}/>}<div><button onClick={()=>void navigator.clipboard.writeText(post.text).then(()=>toast.success("Post copied"),()=>toast.error("Could not copy post"))}><Copy size={14}/>Copy post</button>{image&&<a href={studioAssetUrl(image)} download={image.path.split("/").pop()}><Download size={14}/>Download picture</a>}<a href={"https://x.com/intent/post?text="+encodeURIComponent(post.text)} target="_blank" rel="noreferrer">Open X <ArrowUpRight size={14}/></a></div>{image&&<small>Attach the downloaded picture in X before posting.</small>}</article>;
  })}</section>;
}
