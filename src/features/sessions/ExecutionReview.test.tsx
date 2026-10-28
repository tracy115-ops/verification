// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { I18nContext } from '../../shared/i18n/context';
import { ExecutionReview } from './ExecutionReview';
import { fixturePlan } from '../../domain/execution/fixtures.test-support';

afterEach(cleanup);

it('requires explicit confirmation of the displayed target and script before approving', async () => {
  const plan = await fixturePlan();
  const approve = vi.fn();
  const view = render(
    <I18nContext value="en-US">
      <ExecutionReview plan={plan} busy={false} approve={approve} />
    </I18nContext>,
  );
  const button = screen.getByRole('button');
  expect((button as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText(plan.payload.profile.targetUrl)).toBeTruthy();
  expect(screen.getByText(plan.scriptSha256)).toBeTruthy();
  fireEvent.click(screen.getByRole('checkbox'));
  expect((button as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(button);
  expect(approve).toHaveBeenCalledOnce();
  view.rerender(
    <I18nContext value="en-US">
      <ExecutionReview plan={plan} busy approve={approve} />
    </I18nContext>,
  );
  expect((button as HTMLButtonElement).disabled).toBe(true);
});
