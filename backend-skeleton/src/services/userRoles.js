const VALID_ROLES = new Set(['user', 'child', 'parent']);

export function normalizeUserRole(role) {
  const normalized = typeof role === 'string' ? role.trim().toLowerCase() : '';
  return VALID_ROLES.has(normalized) ? normalized : null;
}

export function resolveUserRole(existingRole, incomingRole) {
  const existing = normalizeUserRole(existingRole);
  const incoming = normalizeUserRole(incomingRole);

  if (existing === 'parent' || incoming === 'parent') {
    return 'parent';
  }

  if (existing === 'child' && (!incoming || incoming === 'user')) {
    return 'child';
  }

  if (incoming) {
    return incoming;
  }

  if (existing) {
    return existing;
  }

  return 'user';
}
