import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';

const visibilityKey = 'verification-workbench.task-panel';
const widthKey = 'verification-workbench.task-panel-width';
const minWidth = 280;

function readPreference(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function savePreference(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* The panel remains usable when device storage is unavailable. */
  }
}

export function useTaskPanel() {
  const container = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; width: number } | null>(null);
  const [open, setOpen] = useState(() => readPreference(visibilityKey) !== 'closed');
  const [preferredWidth, setPreferredWidth] = useState(() => {
    const stored = Number(readPreference(widthKey));
    return Number.isFinite(stored) && stored >= minWidth && stored <= 640 ? stored : 360;
  });
  const [maxWidth, setMaxWidth] = useState(640);
  const [resizing, setResizing] = useState(false);
  const width = Math.min(preferredWidth, maxWidth);

  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setMaxWidth(Math.max(minWidth, Math.min(640, entry.contentRect.width - 380)));
    });
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);

  function resize(next: number) {
    const bounded = Math.round(Math.max(minWidth, Math.min(maxWidth, next)));
    setPreferredWidth(bounded);
    savePreference(widthKey, String(bounded));
  }

  function finishDrag(event: PointerEvent<HTMLDivElement>) {
    drag.current = null;
    setResizing(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return {
    container,
    open,
    resizing,
    style: { '--session-task-width': `${width}px` } as CSSProperties,
    toggle() {
      setOpen((value) => {
        savePreference(visibilityKey, value ? 'closed' : 'open');
        return !value;
      });
    },
    separator: {
      role: 'separator' as const,
      tabIndex: 0,
      'aria-orientation': 'vertical' as const,
      'aria-valuemin': minWidth,
      'aria-valuemax': maxWidth,
      'aria-valuenow': width,
      onPointerDown(event: PointerEvent<HTMLDivElement>) {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.focus();
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { x: event.clientX, width };
        setResizing(true);
      },
      onPointerMove(event: PointerEvent<HTMLDivElement>) {
        if (drag.current) resize(drag.current.width + drag.current.x - event.clientX);
      },
      onPointerUp: finishDrag,
      onPointerCancel: finishDrag,
      onLostPointerCapture() {
        drag.current = null;
        setResizing(false);
      },
      onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
        const next = { ArrowLeft: width + 24, ArrowRight: width - 24, Home: minWidth, End: maxWidth }[
          event.key
        ];
        if (next === undefined) return;
        event.preventDefault();
        resize(next);
      },
      onDoubleClick() {
        resize(360);
      },
    },
  };
}
