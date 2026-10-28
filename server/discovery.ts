import { createSocket } from 'node:dgram';
import { randomUUID } from 'node:crypto';

export const discoveryProtocol = 'verification-workbench';
export const discoveryPort = 4319;

// Replies contain public service metadata only. Access tokens never enter discovery packets.
export function advertiseTeam(port: number, name: string, listenPort = discoveryPort) {
  const socket = createSocket({ type: 'udp4', reuseAddr: true });
  const id = randomUUID();
  let available = false;
  let windowStart = Date.now();
  let replies = 0;
  socket.on('error', () => {
    available = false;
  });
  socket.on('message', (packet, remote) => {
    if (packet.length > 512) return;
    if (Date.now() - windowStart > 1000) {
      windowStart = Date.now();
      replies = 0;
    }
    if (replies >= 30) return;
    try {
      const request = JSON.parse(packet.toString('utf8'));
      if (
        request.protocol !== discoveryProtocol ||
        request.version !== 1 ||
        request.type !== 'discover' ||
        typeof request.nonce !== 'string' ||
        !/^[a-zA-Z0-9-]{1,64}$/.test(request.nonce)
      )
        return;
      replies++;
      const offer = {
        protocol: discoveryProtocol,
        version: 1,
        type: 'offer',
        nonce: request.nonce,
        id,
        name,
        port,
      };
      socket.send(Buffer.from(JSON.stringify(offer)), remote.port, remote.address, () => {});
    } catch {
      // Other UDP traffic is not part of this discovery protocol.
    }
  });
  const ready = new Promise<boolean>((resolve) => {
    socket.once('error', () => resolve(false));
    socket.bind(listenPort, '0.0.0.0', () => {
      available = true;
      resolve(true);
    });
  });
  return {
    ready,
    get listeningPort() {
      const address = socket.address();
      return typeof address === 'object' ? address.port : 0;
    },
    get available() {
      return available;
    },
    close() {
      try {
        socket.close();
      } catch {
        /* Already closed or failed to bind. */
      }
    },
  };
}
