/**
 * Verificatie van Discord-interacties: Ed25519-signature over
 * `X-Signature-Timestamp` + de ruwe request-body, met de public key van de app.
 *
 * Werkt met WebCrypto, dus zowel in een Cloudflare Worker als in Node 20+.
 */

function hexNaarBytes(hex) {
  const s = String(hex ?? '').trim();
  if (!s || s.length % 2 !== 0 || /[^0-9a-f]/i.test(s)) throw new Error('Ongeldige hex-waarde');
  const bytes = new Uint8Array(s.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

/**
 * @returns {Promise<{ ok: boolean, body: string, fout?: string }>}
 */
export async function verifieerDiscordVerzoek(request, publicKeyHex) {
  const signature = request.headers.get('x-signature-ed25519');
  const timestamp = request.headers.get('x-signature-timestamp');
  const body = await request.text();

  if (!signature || !timestamp) return { ok: false, body, fout: 'signature-headers ontbreken' };
  if (!publicKeyHex) return { ok: false, body, fout: 'PUBLIC_KEY ontbreekt' };

  try {
    const key = await crypto.subtle.importKey('raw', hexNaarBytes(publicKeyHex), { name: 'Ed25519' }, false, ['verify']);
    const ok = await crypto.subtle.verify(
      { name: 'Ed25519' },
      key,
      hexNaarBytes(signature),
      new TextEncoder().encode(timestamp + body),
    );
    return { ok, body };
  } catch (err) {
    return { ok: false, body, fout: err.message };
  }
}

export const hexNaarBytesVoorTest = hexNaarBytes;
