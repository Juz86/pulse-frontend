const identityKey = (uid) => `pulse_e2ee_identity_${uid}`;

export const secureKeyStore = {
  async getIdentity(uid) {
    try {
      const raw = localStorage.getItem(identityKey(uid));
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  async saveIdentity(uid, identity) {
    localStorage.setItem(identityKey(uid), JSON.stringify(identity));
  },

  async clearIdentity(uid) {
    localStorage.removeItem(identityKey(uid));
  },
};
