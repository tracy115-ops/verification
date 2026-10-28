import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export function SourceMessage({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const title = text
    .split('\n')
    .find((line) => line.trim())
    ?.replace(/^#+\s*/, '')
    .slice(0, 90);
  return (
    <div className="session-source">
      <button
        className="workbench-btn wb-text"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {title}
      </button>
      {expanded && <div className="session-message-text">{text}</div>}
    </div>
  );
}
