import { en, zh, type Locale, type MessageKey } from './messages';

type CountKind = 'nodes' | 'agents' | 'reviews';
const keys: Record<CountKind, { one: MessageKey; other: MessageKey }> = {
  nodes: { one: 'nodeCountOne', other: 'nodeCountOther' },
  agents: { one: 'agentCountOne', other: 'agentCountOther' },
  reviews: { one: 'reviewCountOne', other: 'reviewCountOther' },
};

export function formatCount(locale: Locale, kind: CountKind, count: number): string {
  const form = new Intl.PluralRules(locale).select(count) === 'one' ? 'one' : 'other';
  const catalog = locale === 'zh-CN' ? zh : en;
  return catalog[keys[kind][form]].replace('{count}', new Intl.NumberFormat(locale).format(count));
}
