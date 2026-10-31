import type { RequirementArtifact } from './types';

export const ANALYSIS_PROMPT_LIMIT = 24_000;
export const byteLength = (text: string) => new TextEncoder().encode(text).length;

export function sourceWindows(spec: string) {
  const windows: { start: number; end: number; text: string; sectionPath: string[] }[] = [];
  const headings = [...spec.matchAll(/^(#{1,6})\s+(.+)$/gm)];
  let start = 0;
  while (start < spec.length) {
    let end = start;
    let bytes = 0;
    for (const char of spec.slice(start)) {
      const count = byteLength(char);
      if (bytes + count > 5_000) break;
      bytes += count;
      end += char.length;
    }
    if (end < spec.length) {
      const newline = spec.lastIndexOf('\n', end - 1) + 1;
      if (newline > start + (end - start) / 2) end = newline;
    }
    const before = Array.from(spec.slice(0, start)).slice(-160).join('');
    const after = Array.from(spec.slice(end)).slice(0, 160).join('');
    const sectionStack: { level: number; title: string }[] = [];
    for (const heading of headings) {
      if (heading.index > start) break;
      const level = heading[1].length;
      while (sectionStack.length && sectionStack.at(-1)!.level >= level) sectionStack.pop();
      sectionStack.push({ level, title: heading[2] });
    }
    const sectionPath = sectionStack.map((heading) => heading.title);
    windows.push({ start, end, text: before + spec.slice(start, end) + after, sectionPath });
    start = end;
  }
  return windows;
}

export function requirementGroups(baseline: RequirementArtifact) {
  const groups: RequirementArtifact['requirements'][] = [];
  for (const requirement of baseline.requirements) {
    if (byteLength(JSON.stringify([requirement])) > 8_000) throw new Error('analysis_request_too_large');
    const last = groups.at(-1);
    if (!last || byteLength(JSON.stringify([...last, requirement])) > 8_000) groups.push([requirement]);
    else last.push(requirement);
  }
  if (groups.length > 32) throw new Error('analysis_plan_limit');
  return groups;
}

export function designGroups(baseline: RequirementArtifact) {
  const groups = requirementGroups(baseline);
  return [
    ...groups.map((requirements) => ({
      requirements,
      cross: false,
      left: [] as string[],
      right: [] as string[],
    })),
    ...groups.flatMap((left, index) =>
      groups.slice(index + 1).map((right) => ({
        requirements: [...left, ...right],
        cross: true,
        left: left.map((item) => item.id),
        right: right.map((item) => item.id),
      })),
    ),
  ];
}
