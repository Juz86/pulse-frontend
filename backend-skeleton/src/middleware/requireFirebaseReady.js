import {
  getFirebaseConfigDiagnostics,
  getFirebaseCredentialMode,
  hasExplicitFirebaseConfig,
} from '../services/firebaseConfig.js';

export function requireFirebaseReady(req, res, next) {
  if (hasExplicitFirebaseConfig()) {
    return next();
  }

  return res.status(503).json({
    ok: false,
    error: 'firebase_not_configured',
    requestId: req.requestId,
    firebaseCredentialMode: getFirebaseCredentialMode(),
    firebase: getFirebaseConfigDiagnostics(),
  });
}
