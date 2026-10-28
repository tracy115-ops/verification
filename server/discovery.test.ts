import { createSocket } from 'node:dgram';
import { expect, it } from 'vitest';
import { advertiseTeam } from './discovery';

it('discovers a real UDP service without exposing credentials and ignores other protocols', async () => {
  const service = advertiseTeam(4317, 'Test team', 0);
  const client = createSocket('udp4');
  try {
    expect(await service.ready).toBe(true);
    const response = new Promise<Buffer>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Discovery timed out')), 2000);
      client.once('message', (data) => {
        clearTimeout(timer);
        resolve(data);
      });
    });
    client.send(Buffer.from('{"protocol":"other"}'), service.listeningPort, '127.0.0.1');
    client.send(
      Buffer.from(
        JSON.stringify({
          protocol: 'verification-workbench',
          version: 1,
          type: 'discover',
          nonce: 'test-nonce',
        }),
      ),
      service.listeningPort,
      '127.0.0.1',
    );
    const offer = JSON.parse((await response).toString());
    expect(offer).toEqual({
      protocol: 'verification-workbench',
      version: 1,
      type: 'offer',
      nonce: 'test-nonce',
      id: expect.any(String),
      name: 'Test team',
      port: 4317,
    });
  } finally {
    client.close();
    service.close();
  }
});
