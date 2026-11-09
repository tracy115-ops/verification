// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { useConversations } from './useConversations';
import { fixturePort, savedDocument, spec } from '../domain/runtime/fixtures.test-support';
import { invokedWorkflow } from '../domain/runtime/workflow-selection';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

it('runs the session-selected saved snapshot and preserves it after template removal', async () => {
  const doc = savedDocument();
  const other = structuredClone(doc);
  other.definition.id = 'permissions';
  other.definition.name = 'Permission checks';
  other.revision = 7;
  const fixture = fixturePort();
  const app = renderHook(
    ({ workflows }) => useConversations(doc.profiles, doc, fixture.port, undefined, workflows),
    {
      initialProps: { workflows: [doc, other] },
    },
  );
  act(() =>
    app.result.current.updateComposerDraft(
      { text: spec, invoke: true, workflowId: 'permissions' },
      'codex-native',
    ),
  );
  await act(async () => {
    await app.result.current.send(spec, true, 'codex-native');
  });
  expect(app.result.current.session?.runs[0].snapshot).toMatchObject({
    revision: 7,
    definition: { id: 'permissions' },
  });
  app.rerender({ workflows: [doc] });
  expect(app.result.current.selectedWorkflow).toBeNull();
  expect(app.result.current.session?.runs[0].snapshot.definition.name).toBe('Permission checks');
  expect(invokedWorkflow('/run general-testing hello', other, [doc, other])).toEqual(doc);
  expect(invokedWorkflow('/run missing hello', other, [doc, other])).toBeNull();
});
