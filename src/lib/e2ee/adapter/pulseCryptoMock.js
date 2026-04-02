function rand(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

function encode(text) {
  return btoa(unescape(encodeURIComponent(text)));
}

function decode(text) {
  return decodeURIComponent(escape(atob(text)));
}

export const pulseCryptoMock = {
  async generateIdentityKeyPair() {
    return {
      publicKey: rand('mock_pub'),
      privateKey: rand('mock_priv'),
    };
  },

  async generateSignedPreKey() {
    return {
      keyId: Date.now(),
      publicKey: rand('mock_spk_pub'),
      privateKey: rand('mock_spk_priv'),
      signature: rand('mock_sig'),
    };
  },

  async generateOneTimePreKeys(count) {
    return Array.from({ length: count }, (_, index) => ({
      keyId: index + 1,
      publicKey: rand(`mock_otk_pub_${index + 1}`),
      privateKey: rand(`mock_otk_priv_${index + 1}`),
    }));
  },

  async createSessionFromPreKeyBundle({ remoteUserId, remoteDeviceId }) {
    return {
      sessionData: JSON.stringify({
        provider: 'mock',
        protocol: 'signal_v1',
        established: true,
        remoteUserId,
        remoteDeviceId,
        createdAt: new Date().toISOString(),
      }),
    };
  },

  async encryptMessage({ sessionData, plaintext }) {
    return {
      ciphertext: encode(plaintext),
      encryptedMessageKey: rand('mock_emk'),
      updatedSessionData: sessionData,
    };
  },

  async decryptMessage({ sessionData, ciphertext }) {
    return {
      plaintext: decode(ciphertext),
      updatedSessionData: sessionData,
    };
  },
};
