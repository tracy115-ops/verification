import { useEffect, useRef } from 'react';

export function useTranscriptScroll(revision: unknown) {
  const anchor = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  useEffect(() => {
    const element = anchor.current?.closest('.session-messages');
    if (!element) return;
    const update = () => {
      following.current = element.scrollHeight - element.scrollTop - element.clientHeight < 100;
    };
    element.addEventListener('scroll', update, { passive: true });
    return () => element.removeEventListener('scroll', update);
  }, []);
  useEffect(() => {
    const element = anchor.current?.closest('.session-messages');
    if (element && following.current) element.scrollTop = element.scrollHeight;
  }, [revision]);
  return anchor;
}
