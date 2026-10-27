import { useState } from 'react';
import { createDocument, decodeDocument } from '../domain/document';
import { checkDocument, type WorkbenchDocument, type WorkflowIssue } from '../domain/workflow';
import { browserRepository } from '../services/repository';
import type { MessageKey } from '../shared/i18n/messages';

function initialDraft(): { document: WorkbenchDocument; notice: MessageKey | null } {
  try {
    return { document: browserRepository(localStorage).load() ?? createDocument(), notice: null };
  } catch {
    return { document: createDocument(), notice: 'loadFailed' };
  }
}

export function useWorkbench() {
  const [initial] = useState(initialDraft);
  const [document, setDocument] = useState(initial.document);
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState<MessageKey | null>(initial.notice);
  const [issues, setIssues] = useState<WorkflowIssue[]>([]);
  function update(next: WorkbenchDocument | ((current: WorkbenchDocument) => WorkbenchDocument)) {
    setDocument(next);
    setDirty(true);
    setNotice(null);
    setIssues([]);
  }
  function validate(): boolean {
    const found = checkDocument(document);
    setIssues(found);
    if (!found.length) setNotice('passed');
    return !found.length;
  }
  function save() {
    if (!validate()) return;
    try {
      setDocument(browserRepository(localStorage).save(document));
      setDirty(false);
      setNotice('savedMessage');
    } catch {
      setNotice('saveFailed');
    }
  }
  function importDraft(text: string) {
    try {
      const imported = decodeDocument(JSON.parse(text));
      update(imported);
      setNotice('imported');
    } catch {
      setNotice('importFailed');
    }
  }
  function exportDraft() {
    if (!validate()) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(document, null, 2)], { type: 'application/json' }),
    );
    const link = window.document.createElement('a');
    link.href = url;
    link.download = `${document.definition.id}.workflow.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice('exported');
  }
  return { document, dirty, notice, issues, update, save, validate, importDraft, exportDraft, setNotice };
}
