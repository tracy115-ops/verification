import { request } from 'node:http';

/** Fixture-only HTTP client; ephemeral loopback ports are not browser destinations. */
export function loopbackJson(url, method, body, user) {
  const target = new URL(url);
  if (target.protocol !== 'http:' || target.hostname !== '127.0.0.1' || target.username || target.password)
    return Promise.reject(new Error('loopback_target_required'));
  return new Promise((resolve, reject) => {
    const req = request(
      target,
      {
        method,
        headers: { 'Content-Type': 'application/json', ...(user ? { 'X-Player': user } : {}) },
      },
      (response) => {
        const chunks = [];
        let size = 0;
        response.on('data', (chunk) => {
          size += chunk.length;
          if (size > 65536) response.destroy(new Error('fixture_response_limit'));
          else chunks.push(chunk);
        });
        response.once('error', reject);
        response.once('end', () => {
          try {
            resolve({
              status: response.statusCode,
              body: JSON.parse(Buffer.concat(chunks).toString('utf8')),
            });
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    req.setTimeout(3000, () => req.destroy(new Error('fixture_timeout')));
    req.once('error', reject);
    req.end(body === undefined ? undefined : JSON.stringify(body));
  });
}
