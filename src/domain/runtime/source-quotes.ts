function normalized(text: string) {
  let value = '';
  const starts: number[] = [],
    ends: number[] = [];
  for (let index = 0; index < text.length; index++) {
    const character = /\s/.test(text[index]) ? ' ' : text[index];
    if (character === ' ' && value.endsWith(' ')) {
      ends[ends.length - 1] = index + 1;
      continue;
    }
    value += character;
    starts.push(index);
    ends.push(index + 1);
  }
  return { value, starts, ends };
}

export function quoteMatcher(spec: string) {
  let cached: ReturnType<typeof normalized> | undefined;
  return (quote: string): string => {
    if (!quote.trim() || Array.from(quote).length > 12000) throw new Error('source_quote_invalid');
    const exact = spec.indexOf(quote);
    if (exact >= 0) {
      if (exact !== spec.lastIndexOf(quote)) throw new Error('source_quote_ambiguous');
      return quote;
    }
    const source = (cached ??= normalized(spec)),
      candidate = normalized(quote.trim()).value;
    const index = source.value.indexOf(candidate);
    if (index < 0) throw new Error('source_quote_invalid');
    if (index !== source.value.lastIndexOf(candidate)) throw new Error('source_quote_ambiguous');
    const result = spec.slice(source.starts[index], source.ends[index + candidate.length - 1]);
    if (Array.from(result).length > 12000) throw new Error('source_quote_invalid');
    return result;
  };
}

export function sourceQuote(spec: string, quote: string): string {
  return quoteMatcher(spec)(quote);
}

export function quoteIssues(requirements: { id: string; quote: string }[], spec: string) {
  const match = quoteMatcher(spec);
  return requirements.flatMap((item) => {
    try {
      match(item.quote);
      return [];
    } catch (error) {
      return [{ id: item.id, code: error instanceof Error ? error.message : 'source_quote_invalid' }];
    }
  });
}
