import admin from 'firebase-admin';

export function isDevAuthBypassEnabled() {
  return process.env.ALLOW_DEV_AUTH_BYPASS === 'true';
}

export function getDevUidFromHeaders(headers = {}) {
  const devUid = headers['x-dev-uid'];
  return typeof devUid === 'string' && devUid.trim() ? devUid.trim() : null;
}

export function getDevUidFromSocketAuth(auth = {}) {
  const devUid = auth.devUid;
  return typeof devUid === 'string' && devUid.trim() ? devUid.trim() : null;
}

export async function requireAuth(req, res, next) {
  if (isDevAuthBypassEnabled()) {
    const devUid = getDevUidFromHeaders(req.headers);
    if (devUid) {
      req.auth = { uid: devUid, devBypass: true };
      return next();
    }
  }

  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer (.+)$/);

  if (!match) {
    return res.status(401).json({ error: 'missing_bearer_token' });
  }

  try {
    const decoded = await admin.auth().verifyIdToken(match[1]);
    req.auth = { uid: decoded.uid };
    next();
  } catch (error) {
    return res.status(401).json({ error: 'invalid_token' });
  }
}
