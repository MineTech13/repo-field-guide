import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { useWide } from '../../hooks';

// Big and small screens remember open/closed separately: on a big screen everything
// starts open, on a small one only the essentials do.
const KEY = 'repo-field-guide:sections:v1';
const WIDE_KEY = 'repo-field-guide:sections-wide:v1';

function loadOpen(key: string): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '{}');
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
  const wide = useWide();
  const key = wide ? WIDE_KEY : KEY;
  const initial = () => loadOpen(key)[props.id] ?? (wide || !!props.defaultOpen);
  const [open, setOpen] = useState(initial);
  // Moving the window to another screen (or resizing) switches to that screen's layout.
  useEffect(() => setOpen(initial()), [wide]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = () => {
    const next = !open;
    setOpen(next);
    try {
      localStorage.setItem(key, JSON.stringify({ ...loadOpen(key), [props.id]: next }));
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
