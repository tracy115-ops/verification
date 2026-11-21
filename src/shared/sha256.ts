export async function sha256Text(source: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source)));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
