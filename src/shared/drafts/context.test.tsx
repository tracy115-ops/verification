// @vitest-environment jsdom
import { Activity, useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DraftProvider, useDraftCount, useDraftStore, useProtectedDraft } from './context';

function Editor({ initial }: { initial: string }) {
  const draft = useProtectedDraft({ id: 'test-model', section: 'agents', title: 'Model', initial });
  return (
    <>
      <input aria-label="model" value={draft.value} onChange={(event) => draft.change(event.target.value)} />
      <span>{draft.conflicted ? 'conflict' : 'current'}</span>
    </>
  );
}
function Harness() {
  const [visible, setVisible] = useState(true);
  const [mounted, setMounted] = useState(true);
  const [initial, setInitial] = useState('saved');
  const store = useDraftStore()!;
  const count = useDraftCount();
  return (
    <>
      <output aria-label="pending">{count}</output>
      <button onClick={() => setVisible(!visible)}>visibility</button>
      <button onClick={() => setMounted(!mounted)}>mount</button>
      <button onClick={() => setInitial('new saved source')}>change source</button>
      <button onClick={() => store.discard('test-model')}>discard</button>
      <Activity mode={visible ? 'visible' : 'hidden'}>{mounted && <Editor initial={initial} />}</Activity>
    </>
  );
}
describe('window-local draft ownership', () => {
  it('retains both pending values and protection through hidden effects and real unmounts', async () => {
    render(
      <DraftProvider>
        <Harness />
      </DraftProvider>,
    );
    fireEvent.change(screen.getByLabelText('model'), { target: { value: 'unfinished' } });
    expect(screen.getByLabelText('pending').textContent).toBe('1');
    await act(async () => fireEvent.click(screen.getByText('visibility')));
    expect(screen.getByLabelText('pending').textContent).toBe('1');
    await act(async () => fireEvent.click(screen.getByText('visibility')));
    fireEvent.click(screen.getByText('mount'));
    expect(screen.getByLabelText('pending').textContent).toBe('1');
    fireEvent.click(screen.getByText('mount'));
    expect((screen.getByLabelText('model') as HTMLInputElement).value).toBe('unfinished');
    fireEvent.click(screen.getByText('change source'));
    expect(screen.getByText('conflict')).toBeTruthy();
    expect((screen.getByLabelText('model') as HTMLInputElement).value).toBe('unfinished');
    fireEvent.click(screen.getByText('discard'));
    expect(screen.getByLabelText('pending').textContent).toBe('0');
    expect((screen.getByLabelText('model') as HTMLInputElement).value).toBe('new saved source');
  });
});
