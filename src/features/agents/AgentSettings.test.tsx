// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { probeAgents } from '../../services/agent-api';
import { AgentSettings } from './AgentSettings';
import type { AgentProfile } from '../../domain/workflow';

vi.mock('../../services/agent-api', () => ({ hasDesktopBridge: () => true, probeAgents: vi.fn() }));
afterEach(cleanup);

const native: AgentProfile = {
  id: 'internal',
  name: 'Internal native fixture',
  driver: 'codeagent',
  protocol: 'native',
  model: '',
  baseUrl: '',
  credentialRef: '',
};
const found = {
  driver: 'codeagent',
  status: 'found',
  version: '1.2605.05.02 (codeAgentCLI)',
  executable: 'C:\\Example Tools\\codeagent.bat',
  reason: null,
} as const;

it('synchronizes native profile installation and version without implying Provider connectivity', async () => {
  vi.mocked(probeAgents).mockResolvedValue([found, { ...found, driver: 'codex' }]);
  const codex: AgentProfile = { ...native, id: 'codex', name: 'Codex missing model', driver: 'codex' };
  const provider: AgentProfile = {
    ...codex,
    id: 'provider',
    name: 'Saved Provider',
    protocol: 'openai-responses',
    model: 'fixture-model',
    baseUrl: 'https://example.invalid',
  };
  render(<AgentSettings profiles={[native, codex, provider]} addProfile={() => {}} notify={() => {}} />);
  const row = (name: string) =>
    within(
      within(document.querySelector('.settings-profiles') as HTMLElement)
        .getByText(name)
        .closest('.settings-profile-row') as HTMLElement,
    );
  expect(row(native.name).getByText('安装未检测')).toBeTruthy();
  fireEvent.click(screen.getByText('检测本机 CLI'));
  await waitFor(() => expect(row(native.name).getByText('已检测 CLI 安装')).toBeTruthy());
  expect(row(native.name).getByText(found.version)).toBeTruthy();
  expect(row(codex.name).getByText('CLI 已发现 · 模型未配置')).toBeTruthy();
  expect(row(provider.name).getByText('Provider 配置 · 接口未检测')).toBeTruthy();
  expect(row(provider.name).queryByText(found.version)).toBeNull();
});

it.each(['missing', 'failed'] as const)(
  'refreshing a %s probe does not retain a stale success badge',
  async (next) => {
    const mock = vi.mocked(probeAgents).mockResolvedValueOnce([found]);
    if (next === 'missing')
      mock.mockResolvedValueOnce([{ ...found, status: 'missing', executable: null, version: null }]);
    else mock.mockRejectedValueOnce(new Error('fixture failure'));
    render(<AgentSettings profiles={[native]} addProfile={() => {}} notify={() => {}} />);
    fireEvent.click(screen.getByText('检测本机 CLI'));
    await waitFor(() => expect(screen.getByText('已检测 CLI 安装')).toBeTruthy());
    fireEvent.click(screen.getByText('检测本机 CLI'));
    await waitFor(() =>
      expect(screen.getByText(next === 'missing' ? '未找到本机 CLI' : '安装未检测')).toBeTruthy(),
    );
    expect(screen.queryByText('已检测 CLI 安装')).toBeNull();
  },
);

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
