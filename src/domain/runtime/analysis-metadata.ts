export function analysisMetadata(prompt: string) {
  try {
    const value = JSON.parse(prompt).analysisBatch;
    if (
      value?.version !== 1 ||
      !['requirements', 'design', 'cross-review'].includes(value.phase) ||
      !Number.isInteger(value.index) ||
      !Number.isInteger(value.total) ||
      value.index < 1 ||
      value.index > value.total ||
      value.total > 600
    )
      return undefined;
    return {
      index: value.index as number,
      total: value.total as number,
      cross: value.phase === 'cross-review',
    };
  } catch {
    return undefined;
  }
}
