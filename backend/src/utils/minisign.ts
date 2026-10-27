import crypto from 'crypto';
import { createReadStream } from 'fs';
import { pipeline } from 'stream/promises';

// Per-alpha mod public keys (modio.public_key in each release's default.cfg); same list as modaudit internal/trust
const TRUSTED_KEYS = [
  'RWQBhIRg+dOifTWlwgYHe8RfD8bqoDh1cCvygboAl3GOUKiCo0NlF4fw', // 0.0.23
  'RWTsHxQMrRq4xwHisyBa2rNQfAedcINzbTT83jeX4/ZcfVxqLfWB4y8w', // 0.0.23b
  'RWRcbM/EwV7bucTiQVCcRBhCkYkXmJEO7s4ktyufkB+gW/NxHhOZ38xh', // 0.0.24
  'RWTVElEmCfAMGk/jtMc2I9/ElBvoJituKdbDWqqj6D69qz2cKexU4gv+', // 0.0.25, 0.0.25b
  'RWQa4XiSn+BLxIYXNrXyz68wwTGWyZ7+kxDtZuLHBXkCtt+lLB8VnpdM', // 0.0.26
  'RWQv2alKl8D0zMDJR766jpYvPy4u3y77HL/iKb/lsT1Fnf6ezoMb2x8+', // 0.0.27, 0.0.27.1
  'RWRoZZuNzi1wX+Hs5NKAf+GghHwye3mFePfBzOFt3mqYUZAkqAvs69W2', // 0.28.0
];

const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

export function keyMap(publicKeys: string[]): Map<string, crypto.KeyObject> {
  return new Map(
    publicKeys.map((k) => {
      const raw = Buffer.from(k, 'base64'); // "Ed" | key id (8) | public key (32)
      const key = crypto.createPublicKey({ key: Buffer.concat([ED25519_SPKI_PREFIX, raw.subarray(10)]), format: 'der', type: 'spki' });
      return [raw.subarray(2, 10).toString('hex'), key];
    })
  );
}

const trustedByKeyId = keyMap(TRUSTED_KEYS);

export async function blake2b512File(path: string): Promise<Buffer> {
  const hash = crypto.createHash('blake2b512');
  await pipeline(createReadStream(path), hash);
  return hash.digest();
}

/**
 * Verify a prehashed (ED) minisign signature text against the trust store.
 * Returns the key id on success, throws otherwise.
 */
export function verifyMinisig(text: string, fileHash: Buffer, keys = trustedByKeyId): string {
  const lines = text.replace(/\r/g, '').trim().split('\n');
  if (lines.length !== 4 || !lines[2].startsWith('trusted comment: ')) {
    throw new Error('malformed minisign signature');
  }
  const sig = Buffer.from(lines[1], 'base64');
  if (sig.length !== 74 || sig.subarray(0, 2).toString() !== 'ED') {
    throw new Error('signature is not a prehashed ED minisign signature');
  }
  const keyId = sig.subarray(2, 10).toString('hex');
  const key = keys.get(keyId);
  if (!key) {
    throw new Error(`signature key ${keyId} is not in the trust store`);
  }
  const signature = sig.subarray(10);
  if (!crypto.verify(null, fileHash, key, signature)) {
    throw new Error('signature does not match the modfile');
  }
  const trustedComment = Buffer.from(lines[2].slice('trusted comment: '.length));
  if (!crypto.verify(null, Buffer.concat([signature, trustedComment]), key, Buffer.from(lines[3], 'base64'))) {
    throw new Error('trusted comment signature is invalid');
  }
  return keyId;
}
