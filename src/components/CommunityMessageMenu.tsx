import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Flag, Pin, Plus, Reply, Trash2, X } from 'lucide-react';
import type { CommunityPost } from '../community-api';

export type MessageMenuAnchor = { post: CommunityPost; x: number; y: number; trigger: HTMLElement };
const reactions = ['❤️','🔥','👍','👎','😂','😍','🤯','😢','🎉','🚀','💎','🐳','🌊','👀','💯','👏','🤝','🙏','💪','🫡','🤔','😎','🥳','💙'];

export function CommunityMessageMenu({ anchor, moderator, canDelete, busy, onClose, onReply, onReact, onPin, onReport, onDelete }: {
  anchor: MessageMenuAnchor; moderator: boolean; canDelete: boolean; busy: boolean;
  onClose: () => void; onReply: () => void; onReact: (emoji: string) => void;
  onPin: () => void; onReport: () => void; onDelete: () => void;
}) {
  const menu = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [position, setPosition] = useState({ left: anchor.x, top: anchor.y });
  const close = useRef(onClose); close.current = onClose;

  useLayoutEffect(() => {
    const rect = menu.current!.getBoundingClientRect(), viewport = window.visualViewport;
    const leftEdge = (viewport?.offsetLeft ?? 0) + 10, topEdge = (viewport?.offsetTop ?? 0) + 10;
    const right = leftEdge + (viewport?.width ?? innerWidth) - 20;
    const bottom = topEdge + (viewport?.height ?? innerHeight) - 20;
    setPosition({ left: Math.max(leftEdge, Math.min(anchor.x - rect.width + 16, right - rect.width)),
      top: Math.max(topEdge, Math.min(anchor.y, bottom - rect.height)) });
  }, [anchor.x, anchor.y, expanded]);

  useEffect(() => {
    menu.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
    const outside = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node) && !anchor.trigger.contains(event.target as Node)) close.current();
    };
    // A tap can finish a pending scroll-to-view event. Only dismiss if the trigger actually moves.
    const triggerPosition=anchor.trigger.getBoundingClientRect();
    const dismissOnScroll = (event: Event) => {
      if(menu.current?.contains(event.target as Node))return;
      const current=anchor.trigger.getBoundingClientRect();
      if(Math.abs(current.top-triggerPosition.top)>1||Math.abs(current.left-triggerPosition.left)>1)close.current();
    };
    const dismiss = () => close.current();
    document.addEventListener('pointerdown', outside, true);
    window.addEventListener('scroll', dismissOnScroll, true);
    window.addEventListener('resize', dismiss);
    window.visualViewport?.addEventListener('resize', dismiss);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      window.removeEventListener('scroll', dismissOnScroll, true);
      window.removeEventListener('resize', dismiss);
      window.visualViewport?.removeEventListener('resize', dismiss);
    };
  }, [anchor.trigger]);

  return createPortal(<div ref={menu} className="community-message-menu" role="menu" aria-label="Message actions" style={position}
    onContextMenu={event => event.preventDefault()} onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); anchor.trigger.focus({ preventScroll: true }); return; }
      if (event.key === 'Tab') { onClose(); return; }
      if (!['ArrowDown','ArrowUp','ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
      event.preventDefault();
      const buttons = [...menu.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
      const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
        : (current + (['ArrowUp','ArrowLeft'].includes(event.key) ? -1 : 1) + buttons.length) % buttons.length;
      buttons[next]?.focus();
    }}>
    <div className="community-quick-reactions">
      {reactions.slice(0,3).map(emoji => <button key={emoji} role="menuitemcheckbox" aria-checked={Boolean(anchor.post.reactions?.find(r=>r.emoji===emoji)?.mine)} aria-label={`React ${emoji}`} disabled={busy} onClick={()=>onReact(emoji)}>{emoji}</button>)}
      <button role="menuitem" aria-label={expanded ? 'Fewer reactions' : 'More reactions'} aria-expanded={expanded} title={expanded ? 'Fewer reactions' : 'More reactions'} onClick={()=>setExpanded(!expanded)}>{expanded ? <X size={17}/> : <Plus size={18}/>}</button>
    </div>
    {expanded && <div className="community-reaction-picker" role="group" aria-label="More reactions">{reactions.slice(3).map(emoji => <button key={emoji} role="menuitemcheckbox" aria-checked={Boolean(anchor.post.reactions?.find(r=>r.emoji===emoji)?.mine)} aria-label={`React ${emoji}`} disabled={busy} onClick={()=>onReact(emoji)}>{emoji}</button>)}</div>}
    {anchor.post.kind==='message'&&<button role="menuitem" onClick={onReply}><Reply size={16}/>Reply</button>}
    {moderator && <button role="menuitem" disabled={busy} onClick={onPin}><Pin size={16}/>Pin message</button>}
    <button role="menuitem" onClick={onReport}><Flag size={16}/>Report</button>
    {canDelete && <button role="menuitem" className="community-danger" disabled={busy} onClick={onDelete}><Trash2 size={16}/>Delete message</button>}
  </div>, document.body);
}
