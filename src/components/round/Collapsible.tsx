import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';

const KEY = 'repo-field-guide:sections:v1';

function loadOpen(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {
    return {};
  }
}

/** A section that folds open/closed and remembers that per browser. */
export function Collapsible(props: {
  id: string;
  title: string;
  /** Short status next to the title, e.g. a count. */
  badge?: ComponentChildren;
  defaultOpen?: boolean;
  /** Visual emphasis when something important is inside. */
  tone?: 'warn' | 'danger';
  children: ComponentChildren;
}) {
  const [open, setOpen] = useState(() => loadOpen()[props.id] ?? !!props.defaultOpen);
  const toggle = () => {
    const next = !open;
    setOpen(next);
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...loadOpen(), [props.id]: next }));
    } catch {
      /* ignore */
    }
  };
  return (
    <section class={`panel fold ${props.tone ? `fold-${props.tone}` : ''}`}>
      <button class="fold-head" aria-expanded={open} onClick={toggle}>
        <span class={`chev ${open ? 'up' : ''}`} aria-hidden="true">
          ▸
        </span>
        <span class="fold-title">{props.title}</span>
        {props.badge != null && <span class="fold-badge">{props.badge}</span>}
      </button>
      {open && <div class="fold-body">{props.children}</div>}
    </section>
  );
}
