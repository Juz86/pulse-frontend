const sessionKey = (uid, remoteUserId, remoteDeviceId) =>
  `pulse_e2ee_session_${uid}_${remoteUserId}_${remoteDeviceId}`;

export const sessionStore = {
  async save(uid, record) {
    localStorage.setItem(
      sessionKey(uid, record.remoteUserId, record.remoteDeviceId),
      JSON.stringify(record)
    );
  },

  async get(uid, remoteUserId, remoteDeviceId) {
    try {
      const raw = localStorage.getItem(sessionKey(uid, remoteUserId, remoteDeviceId));
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  async getByUser(uid, remoteUserId) {
    const prefix = `pulse_e2ee_session_${uid}_${remoteUserId}_`;
    const results = [];

    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(prefix)) continue;

      try {
        const raw = localStorage.getItem(key);
        if (raw) results.push(JSON.parse(raw));
      } catch {
        // Ignore malformed session entries so startup remains resilient.
      }
    }

    return results;
  },
};
