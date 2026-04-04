import admin from 'firebase-admin';

function isDevAuthBypassEnabled() {
  return process.env.ALLOW_DEV_AUTH_BYPASS === 'true';
}

export async function requireAuth(req, res, next) {
  if (isDevAuthBypassEnabled()) {
    const devUid = req.headers['x-dev-uid'];
    if (typeof devUid === 'string' && devUid.trim()) {
      req.auth = { uid: devUid.trim(), devBypass: true };
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
