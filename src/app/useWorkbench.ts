import { useState } from 'react';
import { createDocument, decodeDocument } from '../domain/document';
import { checkDocument, type WorkbenchDocument, type WorkflowIssue } from '../domain/workflow';
import { browserRepository } from '../services/repository';
import { loadProfiles, saveProfiles } from '../services/profile-repository';
import type { AgentProfile } from '../domain/workflow';
import type { MessageKey } from '../shared/i18n/messages';
import { useNotice } from './useNotice';

function initialDraft(): {
  document: WorkbenchDocument;
  saved: WorkbenchDocument | null;
  notice: MessageKey | null;
} {
  try {
    const saved = browserRepository(localStorage).load();
    const document = saved ?? createDocument();
    try {
      return {
        document: {
          ...document,
          profiles: loadProfiles(localStorage, [
            ...document.profiles,
            ...createDocument().profiles.filter(
              (profile) => !document.profiles.some((existing) => existing.id === profile.id),
            ),
          ]),
        },
        saved,
        notice: null,
      };
    } catch {
      return { document, saved, notice: 'loadFailed' };
    }
  } catch {
    return { document: createDocument(), saved: null, notice: 'loadFailed' };
  }
}

export function useWorkbench() {
  const [initial] = useState(initialDraft);
  const [document, setDocument] = useState(initial.document);
  const [savedDocument, setSavedDocument] = useState(initial.saved);
  const [dirty, setDirty] = useState(false);
  const { notice, setNotice, dismissNotice } = useNotice(initial.notice);
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
      const saved = browserRepository(localStorage).save(document);
      setDocument(saved);
      setSavedDocument(structuredClone(saved));
      setDirty(false);
      setNotice('savedMessage');
    } catch {
      setNotice('saveFailed');
    }
  }
  function addProfile(profile: AgentProfile) {
    try {
      const profiles = document.profiles.some((existing) => existing.id === profile.id)
        ? document.profiles.map((existing) => (existing.id === profile.id ? profile : existing))
        : [...document.profiles, profile];
      saveProfiles(localStorage, profiles);
      setDocument((current) => ({ ...current, profiles }));
      setNotice('settingsSaved');
    } catch {
      setNotice('settingsSaveFailed');
    }
  }
  function importDraft(text: string) {
    try {
      const imported = decodeDocument(JSON.parse(text));
      const profiles = [
        ...document.profiles,
        ...imported.profiles.filter(
          (profile) => !document.profiles.some((existing) => existing.id === profile.id),
        ),
      ];
      update({ ...imported, profiles });
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
  return {
    document,
    savedDocument,
    dirty,
    notice,
    issues,
    update,
    save,
    validate,
    importDraft,
    exportDraft,
    setNotice,
    dismissNotice,
    addProfile,
  };
}
