import type { WorkflowNode } from '../workflow';

/** Follow dependency edges, independently of serialization/canvas order. */
export function descendants(nodes: WorkflowNode[], roots: string[]) {
  const children = new Map<string, string[]>();
  for (const node of nodes) {
    for (const parent of node.dependsOn) children.set(parent, [...(children.get(parent) ?? []), node.id]);
  }
  const selected = new Set(roots);
  const pending = [...roots];
  while (pending.length) {
    for (const child of children.get(pending.pop()!) ?? []) {
      if (selected.has(child)) continue;
      selected.add(child);
      pending.push(child);
    }
  }
  return selected;
}
