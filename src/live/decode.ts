import { isGameState, type GameStateV1 } from './schema';

export const SHARE_PREFIX = 'RFG1:';

/** Decode an "RFG1:" copy code: base64url(raw DEFLATE(UTF-8 JSON)). */
export async function decodeShareCode(code: string): Promise<GameStateV1> {
  const trimmed = code.trim();
  if (!trimmed.startsWith(SHARE_PREFIX)) throw new Error('That doesn’t look like a game code (it should start with RFG1:).');
  const b64 = trimmed.slice(SHARE_PREFIX.length).replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);

  let bytes: Uint8Array<ArrayBuffer>;
  try {
    const bin = atob(padded);
    bytes = new Uint8Array(new ArrayBuffer(bin.length));
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } catch {
    throw new Error('The game code is incomplete. Copy it again with the hotkey.');
  }

  let json: string;
  try {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    json = await new Response(stream).text();
  } catch {
    throw new Error('The game code is damaged. Copy it again with the hotkey.');
  }

  const data: unknown = JSON.parse(json);
  if (!isGameState(data)) throw new Error('This game code is from an unsupported companion version.');
  return data;
}
