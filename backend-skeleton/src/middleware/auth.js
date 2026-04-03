import admin from 'firebase-admin';

export async function requireAuth(req, res, next) {
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
