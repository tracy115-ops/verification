// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { useConversations } from './useConversations';
import { completedProposalRun } from '../domain/runtime/design-proposal-fixtures.test-support';
import { savedDocument } from '../domain/runtime/fixtures.test-support';
import { caseContext } from '../domain/runtime/case-revision';
import { caseProposals } from '../domain/runtime/case-proposals';
import { CONVERSATIONS_KEY } from '../services/conversation-repository';
import type { AgentPort } from '../domain/runtime/types';

beforeEach(() => localStorage.clear());
afterEach(cleanup);
async function setup() {
  const run = await completedProposalRun();
  const item = caseContext(run).cases.cases[0];
  localStorage.setItem(
    CONVERSATIONS_KEY,
    JSON.stringify([
      { id: run.sessionId, title: 'Cases', profileId: 'codeagent-native', messages: [], runs: [run] },
    ]),
  );
  const port: AgentPort = {
    cancel: async () => {},
    send: async (request) => {
      expect(JSON.parse(request.prompt).operation).toBe('cases.propose');
      expect(request.model).toBe('');
      return {
        status: 'completed',
        text: JSON.stringify({
          summary: 'Clarify case title',
          cases: [{ action: 'update', value: { ...item, title: 'Observable locked flag' } }],
          questions: [],
        }),
        errorCode: null,
        nativeSessionId: null,
      };
    },
  };
  return renderHook(() => useConversations(savedDocument().profiles, savedDocument(), port));
}
it('prepares and reviews case proposals without changing the design or overwriting the next draft', async () => {
  const app = await setup();
  const run = app.result.current.session!.runs[0];
  act(() => {
    expect(app.result.current.prepareCaseRepair(run, 'Clarify the case')).toBe(true);
  });
  expect(app.result.current.session!.draft).toMatchObject({
    editCases: true,
    editDesign: false,
    invoke: false,
    text: 'Clarify the case',
  });
  await act(async () => {
    await app.result.current.proposeCases(run, 'Clarify the case', 'codeagent-native');
  });
  expect(app.result.current.session!.draft!.text).toBe('');
  const pending = app.result.current.session!.runs[0];
  expect(pending.approvals).toEqual(run.approvals);
  act(() => app.result.current.updateComposerDraft({ text: 'Next request' }, 'codeagent-native'));
  await act(async () => app.result.current.decideCaseProposal(pending, caseProposals(pending)[0].id, true));
  const latest = app.result.current.session!.runs[0];
  expect(latest.approvals).toHaveLength(2);
  expect(caseProposals(latest)[0].status).toBe('applied');
  expect(app.result.current.session!.draft!.text).toBe('Next request');
});
it('rejects manual case saves computed from an older task state', async () => {
  const app = await setup();
  const run = app.result.current.session!.runs[0];
  const value = caseContext(run).cases;
  value.cases = value.cases.map((item) => ({ ...item, title: 'Updated title' }));
  act(() => app.result.current.updateRun(run.sessionId, { ...run, errorCode: 'newer_state' }));
  await act(async () => {
    expect(await app.result.current.reviseCases(run, value, 'Reason')).toBe(false);
  });
  expect(app.result.current.error).toBe('approval_stale');
  expect(app.result.current.session!.runs[0].artifacts['history.cases.1']).toBeUndefined();
});
