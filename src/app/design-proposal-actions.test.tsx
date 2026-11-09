// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { useConversations } from './useConversations';
import {
  completedProposalRun,
  addedScenarioPatch,
} from '../domain/runtime/design-proposal-fixtures.test-support';
import { designProposals } from '../domain/runtime/design-proposals';
import { CONVERSATIONS_KEY } from '../services/conversation-repository';
import { savedDocument } from '../domain/runtime/fixtures.test-support';
import type { AgentPort, TurnOutcome } from '../domain/runtime/types';
import { digest } from '../domain/runtime/plan';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

it('prepares focused design repair without sending, overwriting existing text or accepting stale task state', async () => {
  const app = await setup({
    cancel: async () => {},
    send: async () => {
      throw new Error('No model call expected');
    },
  });
  const run = app.result.current.session!.runs[0];
  act(() =>
    app.result.current.updateComposerDraft(
      { text: '保留已有备注', profileId: 'codeagent-native' },
      'codeagent-native',
    ),
  );
  act(() => {
    expect(app.result.current.prepareDesignRepair(run, '补齐边界场景')).toBe(true);
  });
  const draft = app.result.current.session!.draft!;
  expect(draft).toMatchObject({
    text: '保留已有备注\n\n补齐边界场景',
    editDesign: true,
    invoke: false,
    profileId: 'codeagent-native',
  });
  expect(app.result.current.session!.messages).toEqual([]);
  act(() => {
    expect(app.result.current.prepareDesignRepair(run, '补齐边界场景')).toBe(true);
  });
  expect(app.result.current.session!.draft!.text).toBe(draft.text);
  act(() => app.result.current.updateRun(run.sessionId, { ...run, errorCode: 'newer_state' }));
  act(() => {
    expect(app.result.current.prepareDesignRepair(run, '过期请求')).toBe(false);
  });
  expect(app.result.current.session!.draft!.text).toBe(draft.text);
});

it('keeps a full composer draft when focused repair would exceed the input limit', async () => {
  const app = await setup();
  const run = app.result.current.session!.runs[0];
  const text = 'x'.repeat(39999);
  act(() => app.result.current.updateComposerDraft({ text }, 'codeagent-native'));
  act(() => {
    expect(app.result.current.prepareDesignRepair(run, 'overflow')).toBe(false);
  });
  expect(app.result.current.session!.draft!.text).toBe(text);
  expect(app.result.current.error).toBe('prompt_too_large');
});
async function setup(port?: AgentPort) {
  const run = await completedProposalRun();
  localStorage.setItem(
    CONVERSATIONS_KEY,
    JSON.stringify([
      { id: run.sessionId, title: '设计修订', profileId: 'codeagent-native', messages: [], runs: [run] },
    ]),
  );
  const doc = savedDocument();
  const mock: AgentPort = port ?? {
    cancel: async () => {},
    send: async (request) => {
      expect(request.model).toBe('');
      expect(JSON.parse(request.prompt).operation).toBe('design.propose');
      return {
        status: 'completed',
        text: JSON.stringify(addedScenarioPatch),
        errorCode: null,
        nativeSessionId: null,
      };
    },
  };
  return renderHook(() => useConversations(doc.profiles, doc, mock));
}

it('generates a persistent candidate without changing the design, then applies once', async () => {
  const app = await setup();
  const initial = app.result.current.session!.runs[0];
  await act(async () => {
    expect(await app.result.current.proposeDesign(initial, '补一个场景', 'codeagent-native')).toBe(true);
  });
  const pending = app.result.current.session!.runs[0];
  expect(pending.approvals).toEqual(initial.approvals);
  expect(pending.status).toBe('completed');
  const proposal = designProposals(pending)[0];
  expect(proposal.status).toBe('pending');
  await act(async () => app.result.current.decideDesignProposal(pending, proposal.id, true));
  const applied = app.result.current.session!.runs[0];
  expect(applied.status).toBe('awaiting_review');
  expect(designProposals(applied)[0].status).toBe('applied');
  expect(applied.artifacts['history.design.1']).toBeTruthy();
  await act(async () => app.result.current.decideDesignProposal(applied, proposal.id, true));
  expect(app.result.current.error).toBe('design_proposal_invalid');
  expect(app.result.current.session!.runs[0].artifacts['history.design.2']).toBeUndefined();
});

it('dismisses without reopening approvals and preserves the next unsent draft', async () => {
  const app = await setup();
  const run = app.result.current.session!.runs[0];
  await act(async () => app.result.current.proposeDesign(run, '补充设计', 'codeagent-native'));
  act(() => app.result.current.updateComposerDraft({ text: '下一条输入' }, 'codeagent-native'));
  const pending = app.result.current.session!.runs[0];
  await act(async () =>
    app.result.current.decideDesignProposal(pending, designProposals(pending)[0].id, false),
  );
  expect(app.result.current.session!.draft!.text).toBe('下一条输入');
  expect(app.result.current.session!.runs[0].approvals).toEqual(run.approvals);
  expect(designProposals(app.result.current.session!.runs[0])[0].status).toBe('dismissed');
});

it('does not overwrite a newer run if it changes while approval is being computed', async () => {
  const app = await setup();
  const run = app.result.current.session!.runs[0];
  await act(async () => app.result.current.proposeDesign(run, '补充设计', 'codeagent-native'));
  const pending = app.result.current.session!.runs[0];
  const proposal = designProposals(pending)[0];
  await act(async () => {
    const deciding = app.result.current.decideDesignProposal(pending, proposal.id, true);
    app.result.current.updateRun(run.sessionId, {
      ...pending,
      artifacts: {
        ...pending.artifacts,
        marker: { type: 'FixtureMarker', value: 'newer revision', digest: 'test' },
      },
    });
    await deciding;
  });
  const latest = app.result.current.session!.runs[0];
  expect(latest.artifacts.marker.value).toBe('newer revision');
  expect(latest.artifacts['history.design.1']).toBeUndefined();
  expect(designProposals(latest)[0].status).toBe('stale');
});

it('cancels an in-flight proposal without mutating the design', async () => {
  let finish!: (value: TurnOutcome) => void;
  const app = await setup({
    cancel: async () => {},
    send: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  const original = app.result.current.session!.runs[0];
  let pending!: Promise<boolean>;
  act(() => {
    pending = app.result.current.proposeDesign(original, '补充设计', 'codeagent-native');
  });
  act(() => app.result.current.cancel());
  await act(async () => {
    finish({
      status: 'completed',
      text: JSON.stringify(addedScenarioPatch),
      errorCode: null,
      nativeSessionId: null,
    });
    await pending;
  });
  expect(app.result.current.session!.activeTurnId).toBeUndefined();
  expect(app.result.current.session!.runs[0]).toEqual(original);
});

it('binds confirmation to the exact proposal shown and verifies imported proposal hashes', async () => {
  const app = await setup();
  const run = app.result.current.session!.runs[0];
  await act(async () => app.result.current.proposeDesign(run, '补充设计', 'codeagent-native'));
  const reviewed = app.result.current.session!.runs[0];
  const proposal = designProposals(reviewed)[0];
  const key = `proposal.design.${proposal.id}`;
  const changed = { ...proposal, patch: { ...proposal.patch, summary: '另一个提议版本' } };
  const newHash = await digest(changed);
  act(() =>
    app.result.current.updateRun(run.sessionId, {
      ...reviewed,
      artifacts: {
        ...reviewed.artifacts,
        [key]: { type: 'DesignChangeProposal', value: changed, digest: newHash },
      },
    }),
  );
  await act(async () => app.result.current.decideDesignProposal(reviewed, proposal.id, true));
  expect(app.result.current.error).toBe('design_proposal_stale');
  expect(app.result.current.session!.runs[0].artifacts['history.design.1']).toBeUndefined();
  const current = app.result.current.session!.runs[0];
  const corrupt = {
    ...current,
    artifacts: { ...current.artifacts, [key]: { ...current.artifacts[key], digest: 'tampered' } },
  };
  act(() => app.result.current.updateRun(run.sessionId, corrupt));
  await act(async () => app.result.current.decideDesignProposal(corrupt, proposal.id, true));
  expect(app.result.current.error).toBe('design_proposal_stale');
  expect(app.result.current.session!.runs[0].artifacts['history.design.1']).toBeUndefined();
});
