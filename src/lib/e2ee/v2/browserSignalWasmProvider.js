let providerPromise = null;

function validateProvider(module) {
  const required = [
    'WasmIdentityKeyPair',
    'WasmInMemIdentityKeyStore',
    'WasmInMemKyberPreKeyStore',
    'WasmInMemPreKeyStore',
    'WasmInMemSessionStore',
    'WasmInMemSignedPreKeyStore',
    'WasmProtocolAddress',
    'decryptMessage',
    'encryptMessage',
    'generateRegistrationId',
    'processPreKeyBundle',
  ];
  if (required.some((name) => typeof module[name] !== 'function')) {
    throw new Error('e2ee_browser_wasm_contract_invalid');
  }
}
export function loadBrowserSignalWasmProvider() {
  if (!providerPromise) {
    providerPromise = import('../../../vendor/e2ee/signal-wasm/signal_wasm.mjs')
      .then(async (module) => {
        await module.default();
        module.init();
        validateProvider(module);
        const registrationId = module.generateRegistrationId();
        if (!Number.isInteger(registrationId) || registrationId < 1 || registrationId > 16383) {
          throw new Error('e2ee_browser_wasm_self_test_failed');
        }
        return {
          api: module,
          provider: 'libsignal_wasm_0_105_1',
          privateMaterialExportable: false,
        };
      })
      .catch((error) => {
        providerPromise = null;
        throw error;
      });
  }
  return providerPromise;
}
