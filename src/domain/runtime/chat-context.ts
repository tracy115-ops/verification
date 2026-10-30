import type { ConversationMessage } from './types';

export type ChatContextMode = 'recent' | 'full' | 'current';
type Message = Pick<ConversationMessage, 'role' | 'text' | 'status'>;
const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;

export function chatContext(messages: Message[], mode: ChatContextMode = 'recent') {
  const complete = messages
    .filter((item) => item.status === 'complete')
    .map(({ role, text }) => ({ role, text }));
  let selected = complete;
  if (mode === 'current') selected = complete.slice(-1);
  if (mode === 'recent') {
    selected = [];
    for (const item of complete.slice(-20).reverse()) {
      const candidate = [item, ...selected];
      // Preserve the newest user message whole, even when it exceeds the history budget.
      if (selected.length && bytes(candidate) > 32768) break;
      selected = candidate;
    }
    while (selected[0]?.role === 'assistant') selected.shift();
  }
  return { messages: selected, omitted: complete.length - selected.length, bytes: bytes(selected) };
}
