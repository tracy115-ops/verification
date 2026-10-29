// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { probeAgents } from '../../services/agent-api';
import { AgentSettings } from './AgentSettings';

vi.mock('../../services/agent-api', () => ({ hasDesktopBridge: () => true, probeAgents: vi.fn() }));
afterEach(cleanup);

it('displays the CodeAgent batch path and accepts its internal version format', async () => {
  vi.mocked(probeAgents).mockResolvedValue([
    {
      driver: 'codeagent',
      status: 'found',
      version: '1.2605.05.02 (codeAgentCLI)',
      executable: 'D:\\Program Files\\CodeAgentCLI\\codeagent.bat',
      reason: null,
    },
  ]);
  render(<AgentSettings profiles={[]} addProfile={() => {}} notify={() => {}} />);
  fireEvent.click(screen.getByText('检测本机 CLI'));
  await waitFor(() => expect(screen.getByText('1.2605.05.02 (codeAgentCLI)')).toBeTruthy());
  expect(screen.getByText('D:\\Program Files\\CodeAgentCLI\\codeagent.bat')).toBeTruthy();
});

it('distinguishes a found launcher with a failed version command from an absent installation', async () => {
  vi.mocked(probeAgents).mockResolvedValue([
    {
      driver: 'codeagent',
      status: 'error',
      version: null,
      executable: 'D:\\Program Files\\CodeAgentCLI\\codeagent.bat',
      reason: 'cliProbeVersionFailed',
    },
  ]);
  render(<AgentSettings profiles={[]} addProfile={() => {}} notify={() => {}} />);
  fireEvent.click(screen.getByText('检测本机 CLI'));
  await waitFor(() => expect(screen.getByText('已找到入口 · 版本未确认')).toBeTruthy());
  expect(screen.getByText('入口已找到，但 --version 执行失败。这不代表工具未安装。')).toBeTruthy();
  expect(screen.queryByText('未发现')).toBeNull();
});
