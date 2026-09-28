import { Children, isValidElement, useEffect, useId, useRef, useState, type ReactNode, type SelectHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

type Option = { value: string; label: ReactNode; text: string; disabled: boolean };
function textOf(node: ReactNode): string { return Children.toArray(node).map(child=>typeof child==="string"||typeof child==="number"?String(child):isValidElement<{children?:ReactNode}>(child)?textOf(child.props.children):"").join(""); }
function optionsOf(children: ReactNode, disabled=false): Option[] {
  return Children.toArray(children).flatMap(child=>{
    if(!isValidElement<{value?:string|number;children?:ReactNode;disabled?:boolean}>(child))return [];
    if(child.type==="option")return [{value:String(child.props.value??textOf(child.props.children)),label:child.props.children,text:textOf(child.props.children),disabled:disabled||Boolean(child.props.disabled)}];
    return optionsOf(child.props.children,disabled||Boolean(child.props.disabled));
  });
}

/** Keyboard-accessible, consistently styled picker; the hidden select retains native form values. */
export function Select({children,value,defaultValue,onChange,id,name,disabled,required,className="",style,title,...props}:SelectHTMLAttributes<HTMLSelectElement>) {
  const unique=useId(),listId=`aqua-select-${unique}`,button=useRef<HTMLButtonElement>(null),native=useRef<HTMLSelectElement>(null),list=useRef<HTMLDivElement>(null);
  const options=optionsOf(children),[fallback,setFallback]=useState(String(defaultValue??options[0]?.value??""));
  const selected=String(value??fallback),selectedIndex=options.findIndex(option=>option.value===selected);
  const [open,setOpen]=useState(false),[active,setActive]=useState(Math.max(0,selectedIndex));
  const [position,setPosition]=useState({top:0,left:0,width:180,maxHeight:280});
  const typed=useRef({text:"",at:0});
  useEffect(()=>{if(disabled)setOpen(false);},[disabled]);
  useEffect(()=>{
    if(!open)return;
    const locate=()=>{const box=button.current?.getBoundingClientRect();if(!box)return;const below=window.innerHeight-box.bottom-12,above=box.top-12,height=Math.min(288,Math.max(below,above)),up=below<Math.min(220,options.length*40+12)&&above>below;setPosition({top:up?box.top-6-Math.min(height,options.length*40+12):box.bottom+6,left:Math.max(8,Math.min(box.left,window.innerWidth-Math.max(180,box.width)-8)),width:Math.min(Math.max(180,box.width),window.innerWidth-16),maxHeight:height});};
    const outside=(event:PointerEvent)=>{if(!button.current?.contains(event.target as Node)&&!list.current?.contains(event.target as Node))setOpen(false);};
    locate();document.addEventListener("pointerdown",outside,true);window.addEventListener("resize",locate);window.addEventListener("scroll",locate,true);
    return()=>{document.removeEventListener("pointerdown",outside,true);window.removeEventListener("resize",locate);window.removeEventListener("scroll",locate,true);};
  },[open,options.length]);
  useEffect(()=>{if(open)list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({block:"nearest"});},[active,open]);
  function choose(index:number){const option=options[index];if(!option||option.disabled)return;setFallback(option.value);if(native.current){native.current.value=option.value;native.current.dispatchEvent(new Event("change",{bubbles:true}));}setOpen(false);button.current?.focus({preventScroll:true});}
  function move(direction:number){let next=active;for(let i=0;i<options.length;i++){next=(next+direction+options.length)%options.length;if(!options[next].disabled){setActive(next);break;}}}
  return <span className={`aqua-select ${className}`} style={style}>
    <button type="button" ref={button} id={id} className="aqua-select-trigger" role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={open?listId:undefined} aria-activedescendant={open?`${listId}-${active}`:undefined} aria-label={props["aria-label"]} aria-labelledby={props["aria-labelledby"]} aria-describedby={props["aria-describedby"]} aria-description={props["aria-description"]} title={title} disabled={disabled} onClick={()=>{setActive(Math.max(0,selectedIndex));setOpen(!open);}} onKeyDown={event=>{
      if(event.key==="Escape"&&open){event.preventDefault();event.stopPropagation();setOpen(false);return;}
      if(event.key==="Tab"){setOpen(false);return;}
      if(["ArrowDown","ArrowUp","Home","End","Enter"," "].includes(event.key)){
        event.preventDefault();event.stopPropagation();
        if(!open){setActive(Math.max(0,selectedIndex));setOpen(true);return;}
        if(event.key==="Enter"||event.key===" ")choose(active);
        else if(event.key==="Home")setActive(options.findIndex(option=>!option.disabled));
        else if(event.key==="End")setActive(options.map((option,index)=>option.disabled?-1:index).filter(index=>index>=0).pop()??0);
        else move(event.key==="ArrowDown"?1:-1);
      }else if(event.key.length===1&&!event.ctrlKey&&!event.metaKey&&!event.altKey){typed.current={text:(Date.now()-typed.current.at<700?typed.current.text:"")+event.key.toLowerCase(),at:Date.now()};const found=options.findIndex(option=>!option.disabled&&option.text.toLowerCase().startsWith(typed.current.text));if(found>=0){event.preventDefault();setOpen(true);setActive(found);}}
    }}><span>{options[selectedIndex]?.label??"Select"}</span><ChevronDown size={15}/></button>
    <select ref={native} name={name} value={selected} disabled={disabled} required={required} onChange={onChange} tabIndex={-1} aria-hidden="true" className="aqua-select-native">{children}</select>
    {open&&createPortal(<div ref={list} id={listId} className="aqua-select-options" role="listbox" aria-label={props["aria-label"]??"Options"} style={position} onMouseDown={event=>{event.preventDefault();event.stopPropagation();}} onClick={event=>event.stopPropagation()}>{options.map((option,index)=><div key={`${option.value}-${index}`} id={`${listId}-${index}`} data-index={index} role="option" aria-selected={selected===option.value} aria-disabled={option.disabled||undefined} className={active===index?"active":""} onMouseEnter={()=>{if(!option.disabled)setActive(index);}} onClick={()=>choose(index)}><span>{option.label}</span>{selected===option.value&&<Check size={15}/>}</div>)}</div>,document.body)}
  </span>;
}
