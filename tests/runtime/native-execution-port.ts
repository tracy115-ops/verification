import { spawn } from 'node:child_process';
import path from 'node:path';
import { decodeEvidence, decodePlan } from '../../src/domain/execution/validation';
import type { ExecutionPort, ExecutionPayload, ExecutionPlan } from '../../src/domain/execution/types';

export function nativeExecutionPort(root: string): ExecutionPort {
  const binary = path.resolve(`target/debug/examples/local${process.platform === 'win32' ? '.exe' : ''}`);
  async function request(
    operation: string,
    payload: ExecutionPayload,
    approvedDigest?: string,
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const child = spawn(binary, [root], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
      let stdout = '';
      let stderr = '';
      const timer = setTimeout(() => child.kill(), 350000);
      child.stdout.on('data', (value) => {
        stdout += value.toString();
      });
      child.stderr.on('data', (value) => {
        stderr += value.toString();
      });
      child.once('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.once('close', (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          reject(new Error(`native_execution_failed:${stderr.slice(-500)}`));
          return;
        }
        try {
          const value: unknown = JSON.parse(stdout);
          if (!value || typeof value !== 'object') throw new Error('execution_invalid');
          if ('Err' in value) throw new Error(String(value.Err));
          if (!('Ok' in value)) throw new Error('execution_invalid');
          resolve(value.Ok);
        } catch (error) {
          reject(error);
        }
      });
      child.stdin.end(JSON.stringify({ operation, payload, approvedDigest: approvedDigest ?? null }));
    });
  }
  return {
    async preflight(payload) {
      return decodePlan(await request('preflight', payload));
    },
    async execute(plan: ExecutionPlan, digest: string) {
      return decodeEvidence(await request('execute', plan.payload, digest), plan);
    },
    async cancel() {
      throw new Error('integration_cancel_not_supported');
    },
  };
}
