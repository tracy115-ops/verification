import type { WorkbenchDocument } from '../workflow';

export function invokedWorkflow(
  text: string,
  selected: WorkbenchDocument | null,
  workflows: WorkbenchDocument[] = [],
) {
  const id = /^\/run\s+(\S+)/.exec(text)?.[1];
  return id
    ? (workflows.find((item) => item.definition.id === id) ??
        (selected?.definition.id === id ? selected : null))
    : selected;
}
