import { expect, it } from 'vitest';
import { completedProposalRun, addedScenarioPatch } from './design-proposal-fixtures.test-support';
import { caseContext, reviseCases } from './case-revision';
import {
  caseProposals,
  createCaseProposal,
  applyCaseProposal,
  mergeCasePatch,
  caseProposalBaseDigest,
} from './case-proposals';
import { latestArtifact } from './bindings';
import { advanceRun, approveRun } from './engine';
import { verificationRun, verificationPorts } from '../execution/fixtures.test-support';
import { reviseDesign } from './design-revision';
import { design } from './fixtures.test-support';
import { decodeConversations } from '../../services/conversation-repository';

it('preserves requirements/design while archiving cases and invalidating reordered descendants', async () => {
  const run = await completedProposalRun();
  run.plan.reverse();
  const previous = structuredClone(run);
  const cases = caseContext(run).cases;
  const value = { cases: cases.cases.map((item) => ({ ...item, title: `${item.title} clarified` })) };
  const oldReview = run.plan.find((node) => node.operation === 'review.cases')!;
  const next = await reviseCases(run, value, 'Make the assertion observable');
  expect(run).toEqual(previous);
  expect(next.status).toBe('awaiting_review');
  expect(next.approvals).toHaveLength(2);
  expect(latestArtifact(next, 'RequirementBaseline')).toEqual(latestArtifact(run, 'RequirementBaseline'));
  expect(latestArtifact(next, 'TestDesign')).toEqual(latestArtifact(run, 'TestDesign'));
  expect(latestArtifact(next, 'TestCaseSet')).toBeUndefined();
  expect(latestArtifact(next, 'TestCaseSetDraft')).toEqual(value);
  expect(next.artifacts['history.cases.1'].value).toMatchObject({
    source: 'human',
    artifacts: run.artifacts,
    approvals: run.approvals,
  });
  await expect(approveRun(next, oldReview.id, run.steps[oldReview.id].reviewDigest!)).rejects.toThrow(
    'approval_stale',
  );
  const confirmed = await approveRun(next, oldReview.id, next.steps[oldReview.id].reviewDigest!);
  expect(latestArtifact(confirmed, 'TestCaseSet')).toEqual(value);
});

it('validates references and scope, rejects no-op/running edits and never mutates the source on failure', async () => {
  const run = await completedProposalRun();
  const value = caseContext(run).cases;
  const original = structuredClone(run);
  await expect(reviseCases(run, value, 'Unchanged')).rejects.toThrow('case_proposal_empty');
  await expect(reviseCases({ ...run, status: 'running' }, value, 'Reason')).rejects.toThrow(
    'approval_invalid',
  );
  await expect(
    reviseCases(run, { cases: [{ ...value.cases[0], scenarioIds: ['unknown'] }] }, 'Reason'),
  ).rejects.toThrow('artifact_invalid');
  expect(run).toEqual(original);
});

it('merges bounded incremental cases and blocks stale, malformed and unanswered proposals', async () => {
  const run = await completedProposalRun();
  const item = caseContext(run).cases.cases[0];
  const patch = {
    summary: 'Clarify status assertion',
    cases: [
      { action: 'update' as const, value: { ...item, assertions: ['Observe the documented locked flag'] } },
    ],
    questions: [],
  };
  const proposal = await createCaseProposal(
    run,
    patch,
    'Clarify the observable assertion',
    crypto.randomUUID(),
  );
  expect(caseContext(run).cases.cases[0]).toEqual(item);
  expect(proposal.before.cases).toEqual([item]);
  const next = await applyCaseProposal(run, proposal);
  expect(next.artifacts['history.cases.1'].value).toMatchObject({
    source: 'agent_approved',
    attribution: { proposalId: proposal.id },
  });
  expect(latestArtifact(next, 'TestCaseSetDraft')).toEqual(mergeCasePatch(run, patch));
  expect(await caseProposalBaseDigest(next)).not.toBe(proposal.baseDigest);
  await expect(applyCaseProposal(next, proposal)).rejects.toThrow('case_proposal_stale');
  const unanswered = await createCaseProposal(
    run,
    { summary: 'Unknown recovery rule', cases: [], questions: ['How does recovery work?'] },
    'Ask about recovery',
    crypto.randomUUID(),
  );
  await expect(applyCaseProposal(run, unanswered)).rejects.toThrow('review_unresolved');
  expect(() => mergeCasePatch(run, { ...patch, cases: [...patch.cases, ...patch.cases] })).toThrow(
    'case_proposal_invalid',
  );
  expect(() => mergeCasePatch(run, { ...patch, cases: [{ action: 'add', value: item }] })).toThrow(
    'case_proposal_invalid',
  );
  expect(() =>
    mergeCasePatch(run, { ...patch, cases: [{ action: 'update', value: { ...item, expected: ' ' } }] }),
  ).toThrow('case_proposal_invalid');
});

it('expires pending case proposals after case or design changes, and validates imported proposal ownership', async () => {
  const run = await completedProposalRun();
  const item = caseContext(run).cases.cases[0];
  const patch = {
    summary: 'Add an independent case',
    cases: [{ action: 'add' as const, value: { ...item, id: 'TC_NEW' } }],
    questions: [],
  };
  const proposal = await createCaseProposal(run, patch, 'Add one case', crypto.randomUUID());
  const key = `proposal.cases.${proposal.id}`;
  run.artifacts[key] = { type: 'CaseChangeProposal', digest: 'p', value: proposal };
  const next = await applyCaseProposal(run, proposal);
  expect(caseProposals(next)[0].status).toBe('stale');
  const designChanged = await reviseDesign(
    run,
    { ...design, scenarios: [...design.scenarios, addedScenarioPatch.scenarios[0].value] },
    'Review new scenario',
  );
  expect(caseProposals(designChanged)[0].status).toBe('stale');
  const session = {
    id: run.sessionId,
    title: '',
    profileId: run.defaultProfileId,
    messages: [],
    runs: [run],
  };
  expect(decodeConversations([session])[0].runs[0].artifacts[key]).toBeDefined();
  run.artifacts[key] = { ...run.artifacts[key], value: { ...proposal, runId: 'another-run' } };
  expect(() => decodeConversations([session])).toThrow('session_storage_invalid');
});

it('invalidates script mappings, execution approval and evidence after changing an executed case', async () => {
  const ports = verificationPorts('passed');
  let run = verificationRun();
  for (let i = 0; i < 6 && run.status !== 'completed'; i++) {
    run = await advanceRun(
      run,
      ports.agent,
      new AbortController().signal,
      () => {},
      () => {},
      ports.execution,
    );
    const review = run.plan.find((node) => run.steps[node.id].status === 'awaiting_review');
    if (review) run = await approveRun(run, review.id, run.steps[review.id].reviewDigest!);
  }
  expect(run.status).toBe('completed');
  expect(latestArtifact(run, 'EvidenceBundle')).toBeDefined();
  run.plan.reverse();
  const value = caseContext(run).cases;
  value.cases = value.cases.map((item) => ({ ...item, title: `${item.title} clarified` }));
  const next = await reviseCases(run, value, 'Clarify the approved oracle');
  for (const type of [
    'ImplementationBundle',
    'ExecutionPlan',
    'ExecutionAuthorization',
    'EvidenceBundle',
    'VerificationReport',
  ])
    expect(latestArtifact(next, type)).toBeUndefined();
  expect(next.approvals).toHaveLength(2);
  expect(next.artifacts['history.cases.1'].value).toMatchObject({ artifacts: run.artifacts });
});
