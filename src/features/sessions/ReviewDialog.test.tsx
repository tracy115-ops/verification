// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ReviewDialog } from './ReviewDialog';

afterEach(cleanup);
it('opens the dedicated review workspace and supports returning to the conversation', () => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value() {} });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value() {} });
  const show = vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function (
    this: HTMLDialogElement,
  ) {
    this.open = true;
  });
  const hide = vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function (
    this: HTMLDialogElement,
  ) {
    this.open = false;
  });
  const close = vi.fn();
  const view = render(
    <ReviewDialog open close={close}>
      <p>Review content</p>
    </ReviewDialog>,
  );
  expect(show).toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '返回对话' }));
  expect(close).toHaveBeenCalledOnce();
  view.rerender(
    <ReviewDialog open={false} close={close}>
      <p>Review content</p>
    </ReviewDialog>,
  );
  expect(hide).toHaveBeenCalled();
  expect(screen.queryByText('Review content')).toBeNull();
  show.mockRestore();
  hide.mockRestore();
});

it('keeps a saving dialog open when Escape or the close button is used', () => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value() {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value() {
      this.open = false;
    },
  });
  const close = vi.fn();
  render(
    <ReviewDialog open busy close={close}>
      <p>Saving</p>
    </ReviewDialog>,
  );
  expect((screen.getByRole('button', { name: '返回对话' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: false, cancelable: true }));
  expect(close).not.toHaveBeenCalled();
});
