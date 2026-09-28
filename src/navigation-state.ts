import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
const scrollPositions=new Map<string,number>();
export function lastExploreLocation(){try{return sessionStorage.getItem("aqua:explore-location")||"/";}catch{return "/";}}
export function usePageScroll(){
  const location=useLocation(),path=location.pathname,position=useRef(0);
  useEffect(()=>{if(path==="/")try{sessionStorage.setItem("aqua:explore-location","/"+location.search);}catch{}},[path,location.search]);
  useLayoutEffect(()=>{
    const target=path==="/"?(scrollPositions.get(path)??0):0;
    let frame=0,attempts=0;
    const restore=()=>{window.scrollTo({top:target,behavior:"instant"});if(target>0&&window.scrollY<target-2&&attempts++<60)frame=requestAnimationFrame(restore);};
    restore();position.current=window.scrollY;
    const track=()=>{position.current=window.scrollY;};
    const stop=()=>{cancelAnimationFrame(frame);};
    window.addEventListener("scroll",track,{passive:true});window.addEventListener("wheel",stop,{passive:true});window.addEventListener("touchstart",stop,{passive:true});
    return()=>{scrollPositions.set(path,position.current);cancelAnimationFrame(frame);window.removeEventListener("scroll",track);window.removeEventListener("wheel",stop);window.removeEventListener("touchstart",stop);};
  },[path]);
}
