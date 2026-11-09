import { useState } from 'react';
import { createDocument, decodeDocument, shareableDocument } from '../domain/document';
import { checkDocument, type WorkbenchDocument, type WorkflowIssue } from '../domain/workflow';
import { browserRepository } from '../services/repository';
import { loadProfiles, saveProfiles } from '../services/profile-repository';
import type { AgentProfile } from '../domain/workflow';
import type { MessageKey } from '../shared/i18n/messages';
import { useNotice } from './useNotice';
import { newId } from '../shared/id';

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
  const [library, setLibrary] = useState(() => {
    try {
      return browserRepository(localStorage).list();
    } catch {
      return [];
    }
  });
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
  function persist(next: WorkbenchDocument) {
    try {
      const saved = browserRepository(localStorage).save(next);
      setDocument(saved);
      setSavedDocument(structuredClone(saved));
      setLibrary(browserRepository(localStorage).list());
      setDirty(false);
      setIssues([]);
      setNotice('savedMessage');
      return true;
    } catch {
      setNotice('saveFailed');
      return false;
    }
  }
  function save() {
    if (validate()) persist(document);
  }
  function renameWorkflow(name: string) {
    if (dirty || !name.trim() || name.trim().length > 200) return false;
    return persist({ ...document, definition: { ...document.definition, name: name.trim() } });
  }
  function selectWorkflow(id: string) {
    if (dirty) return false;
    try {
      const saved = browserRepository(localStorage).select(id);
      setDocument({ ...saved, profiles: document.profiles });
      setSavedDocument(saved);
      setIssues([]);
      return true;
    } catch {
      setNotice('loadFailed');
      return false;
    }
  }
  function createWorkflow(name: string, copy: boolean) {
    if (dirty || !name.trim() || name.trim().length > 200) return false;
    const source = copy ? document : createDocument();
    const next = {
      ...structuredClone(source),
      revision: 0,
      profiles: document.profiles,
      definition: { ...structuredClone(source.definition), id: `workflow-${newId()}`, name: name.trim() },
    };
    return persist(next);
  }
  function deleteWorkflow(id: string) {
    if (dirty) return false;
    try {
      const next = browserRepository(localStorage).remove(id);
      setLibrary(browserRepository(localStorage).list());
      setDocument({ ...(next ?? createDocument()), profiles: document.profiles });
      setSavedDocument(next);
      setIssues([]);
      return true;
    } catch {
      setNotice('saveFailed');
      return false;
    }
  }
  function discardWorkflowChanges() {
    setDocument({ ...(savedDocument ?? createDocument()), profiles: document.profiles });
    setDirty(false);
    setIssues([]);
  }
  function addProfile(profile: AgentProfile) {
    try {
      const profiles = document.profiles.some((existing) => existing.id === profile.id)
        ? document.profiles.map((existing) => (existing.id === profile.id ? profile : existing))
        : [...document.profiles, profile];
      saveProfiles(localStorage, profiles);
      setDocument((current) => ({ ...current, profiles }));
      setNotice('settingsSaved');
      return true;
    } catch {
      setNotice('settingsSaveFailed');
      return false;
    }
  }
  function importDraft(text: string) {
    if (dirty) {
      setNotice('workflowDirtyGuard');
      return;
    }
    try {
      const imported = decodeDocument(JSON.parse(text));
      const profiles = [
        ...document.profiles,
        ...imported.profiles.filter(
          (profile) => !document.profiles.some((existing) => existing.id === profile.id),
        ),
      ];
      // Import creates a distinct draft; never overwrite a saved workflow by ID.
      update({
        ...imported,
        revision: 0,
        definition: { ...imported.definition, id: `workflow-${newId()}` },
        profiles,
      });
      setNotice('imported');
    } catch {
      setNotice('importFailed');
    }
  }
  function exportDraft() {
    if (!validate()) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(shareableDocument(document), null, 2)], { type: 'application/json' }),
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
    library,
    selectWorkflow,
    createWorkflow,
    renameWorkflow,
    deleteWorkflow,
    discardWorkflowChanges,
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
