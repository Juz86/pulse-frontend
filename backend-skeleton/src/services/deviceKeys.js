export function normalizeOneTimePreKeys(oneTimePreKeys = []) {
  if (!Array.isArray(oneTimePreKeys)) return [];

  return oneTimePreKeys.filter((item) => (
    item &&
    typeof item === 'object' &&
    item.keyId !== undefined &&
    item.keyId !== null &&
    item.publicKey
  ));
}

export function consumeOneTimePreKey(oneTimePreKeys = []) {
  const normalized = normalizeOneTimePreKeys(oneTimePreKeys);
  const [issuedPreKey = null, ...remainingPreKeys] = normalized;

  return {
    issuedPreKey,
    remainingPreKeys,
    remainingCount: remainingPreKeys.length,
  };
}

export function appendUniqueOneTimePreKeys(existingPreKeys = [], incomingPreKeys = []) {
  const normalizedExisting = normalizeOneTimePreKeys(existingPreKeys);
  const normalizedIncoming = normalizeOneTimePreKeys(incomingPreKeys);
  const byKeyId = new Map(normalizedExisting.map((item) => [String(item.keyId), item]));

  for (const item of normalizedIncoming) {
    byKeyId.set(String(item.keyId), item);
  }

  return Array.from(byKeyId.values()).sort((a, b) => Number(a.keyId) - Number(b.keyId));
}
