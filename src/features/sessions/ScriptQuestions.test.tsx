// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ScriptQuestions } from './ScriptQuestions';
import { verificationRun, implementation } from '../../domain/execution/fixtures.test-support';
import type { Conversations } from '../../app/useConversations';

afterEach(cleanup);
it('requires answers to every blocking question and submits the displayed script digest', () => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = false;
    },
  });
  const run = verificationRun();
  run.status = 'failed';
  run.errorCode = 'review_unresolved';
  run.artifacts.script = {
    type: 'ImplementationBundle',
    digest: 'displayed-digest',
    value: { ...implementation, questions: ['Response field?', 'Fixture reset?'] },
  };
  const reviseScript = vi.fn();
  render(<ScriptQuestions run={run} actions={{ busy: false, reviseScript } as unknown as Conversations} />);
  fireEvent.click(screen.getByRole('button', { name: '处理脚本澄清' }));
  const save = screen.getByRole('button', { name: '保存补充并重新生成脚本' }) as HTMLButtonElement;
  expect(save.disabled).toBe(true);
  fireEvent.change(screen.getByRole('textbox', { name: 'Response field?' }), {
    target: { value: 'body.score' },
  });
  expect(save.disabled).toBe(true);
  fireEvent.change(screen.getByRole('textbox', { name: 'Fixture reset?' }), {
    target: { value: 'Framework setUp' },
  });
  fireEvent.click(save);
  expect(reviseScript).toHaveBeenCalledWith(run, 'displayed-digest', {
    'Response field?': 'body.score',
    'Fixture reset?': 'Framework setUp',
  });
});
