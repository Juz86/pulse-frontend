package com.pulsemessenger.chat.e2ee.v2;

import android.util.Base64;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.pulsemessenger.chat.BuildConfig;

@CapacitorPlugin(name = "PulseE2eeV2")
public final class PulseE2eeV2Plugin extends Plugin {
    private PulseE2eeSecureStore secureStore;
    private PulseE2eeV2Provider provider;
    private PulseE2eeMessageHistory messageHistory;

    @Override
    public void load() {
        super.load();
        secureStore = new PulseE2eeSecureStore(getContext());
        provider = new PulseE2eeV2Provider(secureStore);
        messageHistory = new PulseE2eeMessageHistory(secureStore);
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        try {
            boolean providerAvailable = isProviderAvailable();
            if (!providerAvailable) {
                JSObject response = new JSObject();
                response.put("ok", true);
                response.put("protocol", "pulse_e2ee_v2");
                response.put("protocolVersion", 2);
                response.put("providerAvailable", false);
                response.put("provider", "libsignal_android_disabled");
                response.put("secureStorage", false);
                response.put("hardwareBackedKeystore", false);
                response.put("strongBoxBacked", false);
                response.put("privateMaterialExportable", false);
                call.resolve(response);
                return;
            }
            PulseE2eeSecureStore.Capabilities capabilities = secureStore.capabilities();
            JSObject response = new JSObject();
            response.put("ok", true);
            response.put("protocol", "pulse_e2ee_v2");
            response.put("protocolVersion", 2);
            response.put("providerAvailable", true);
            response.put(
                "provider",
                BuildConfig.DEBUG
                    ? "libsignal_android_internal_qa"
                    : "libsignal_android_production_pilot"
            );
            response.put("secureStorage", capabilities.secureStorage);
            response.put("hardwareBackedKeystore", capabilities.hardwareBacked);
            response.put("strongBoxBacked", capabilities.strongBoxBacked);
            response.put("privateMaterialExportable", false);
            call.resolve(response);
        } catch (Exception error) {
            call.reject("e2ee_secure_storage_unavailable", safeMessage(error), error);
        }
    }

    @PluginMethod
    public void bootstrapDevice(PluginCall call) {
        try {
            requireProviderAvailable();
            String userId = requiredString(call, "userId", "e2ee_user_id_required");
            int signalDeviceId = requiredInt(
                call.getInt("signalDeviceId"),
                "e2ee_signal_device_id_required"
            );
            int preKeyCount = call.getInt(
                "preKeyCount",
                PulseE2eeV2Provider.DEFAULT_PREKEY_COUNT
            );
            PulseE2eeV2Provider.BootstrapResult result = provider.bootstrapDevice(
                userId,
                signalDeviceId,
                preKeyCount
            );
            call.resolve(bootstrapResponse(result, secureStore.capabilities()));
        } catch (Exception error) {
            call.reject("e2ee_bootstrap_failed", safeMessage(error), error);
        }
    }

    @PluginMethod
    public void encryptText(PluginCall call) {
        try {
            requireProviderAvailable();
            String userId = requiredString(call, "userId", "e2ee_user_id_required");
            int localSignalDeviceId = requiredInt(
                call.getInt("localSignalDeviceId"),
                "e2ee_signal_device_id_required"
            );
            String remoteUserId = requiredString(
                call,
                "remoteUserId",
                "e2ee_remote_user_id_required"
            );
            String remoteDeviceId = requiredString(
                call,
                "remoteDeviceId",
                "e2ee_remote_device_id_required"
            );
            int remoteSignalDeviceId = requiredInt(
                call.getInt("remoteSignalDeviceId"),
                "e2ee_remote_signal_device_id_required"
            );
            int remoteIdentityVersion = requiredInt(
                call.getInt("remoteIdentityVersion"),
                "e2ee_remote_identity_version_required"
            );
            JSObject remoteBundleValue = call.getObject("remoteBundle");
            PulseLibsignalSessionEngine.PublicBundle remoteBundle = remoteBundleValue == null
                ? null
                : decodePublicBundle(remoteBundleValue);
            PulseLibsignalSessionEngine.EncryptedEnvelope envelope = provider.encryptText(
                userId,
                localSignalDeviceId,
                remoteUserId,
                remoteDeviceId,
                remoteSignalDeviceId,
                remoteIdentityVersion,
                requiredString(call, "plaintext", "e2ee_plaintext_required"),
                remoteBundle
            );
            call.resolve(envelopeResponse(envelope));
        } catch (Exception error) {
            call.reject("e2ee_encrypt_failed", safeMessage(error), error);
        }
    }

    @PluginMethod
    public void decryptText(PluginCall call) {
        try {
            requireProviderAvailable();
            String userId = requiredString(call, "userId", "e2ee_user_id_required");
            int localSignalDeviceId = requiredInt(
                call.getInt("localSignalDeviceId"),
                "e2ee_signal_device_id_required"
            );
            String remoteUserId = requiredString(
                call,
                "remoteUserId",
                "e2ee_remote_user_id_required"
            );
            String remoteDeviceId = requiredString(
                call,
                "remoteDeviceId",
                "e2ee_remote_device_id_required"
            );
            int remoteSignalDeviceId = requiredInt(
                call.getInt("remoteSignalDeviceId"),
                "e2ee_remote_signal_device_id_required"
            );
            int remoteIdentityVersion = requiredInt(
                call.getInt("remoteIdentityVersion"),
                "e2ee_remote_identity_version_required"
            );
            PulseLibsignalSessionEngine.EncryptedEnvelope envelope =
                new PulseLibsignalSessionEngine.EncryptedEnvelope(
                    requiredString(call, "envelopeType", "e2ee_envelope_type_required"),
                    decodeBase64(requiredString(call, "ciphertext", "e2ee_ciphertext_required"))
                );
            String plaintext = provider.decryptText(
                userId,
                localSignalDeviceId,
                remoteUserId,
                remoteDeviceId,
                remoteSignalDeviceId,
                remoteIdentityVersion,
                envelope
            );
            JSObject response = protocolResponse();
            response.put("plaintext", plaintext);
            call.resolve(response);
        } catch (Exception error) {
            call.reject("e2ee_decrypt_failed", safeMessage(error), error);
        }
    }

    @PluginMethod
    public void listSessionDevices(PluginCall call) {
        try {
            requireProviderAvailable();
            String userId = requiredString(call, "userId", "e2ee_user_id_required");
            int localSignalDeviceId = requiredInt(
                call.getInt("localSignalDeviceId"),
                "e2ee_signal_device_id_required"
            );
            String remoteUserId = requiredString(
                call,
                "remoteUserId",
                "e2ee_remote_user_id_required"
            );
            JSArray devices = new JSArray();
            for (
                PulseSignalProtocolStore.RemoteDevice device
                : provider.listSessionDevices(userId, localSignalDeviceId, remoteUserId)
            ) {
                JSObject value = new JSObject();
                value.put("deviceId", device.remoteDeviceId);
                value.put("signalDeviceId", device.signalDeviceId);
                value.put("identityVersion", device.identityVersion);
                devices.put(value);
            }
            JSObject response = protocolResponse();
            response.put("devices", devices);
            call.resolve(response);
        } catch (Exception error) {
            call.reject("e2ee_session_devices_failed", safeMessage(error), error);
        }
    }

    @PluginMethod
    public void invalidateRemoteDevice(PluginCall call) {
        try {
            requireProviderAvailable();
            provider.invalidateRemoteDevice(
                requiredString(call, "userId", "e2ee_user_id_required"),
                requiredInt(call.getInt("localSignalDeviceId"), "e2ee_signal_device_id_required"),
                requiredString(call, "remoteUserId", "e2ee_remote_user_id_required"),
                requiredString(call, "remoteDeviceId", "e2ee_remote_device_id_required"),
                requiredInt(
                    call.getInt("remoteSignalDeviceId"),
                    "e2ee_remote_signal_device_id_required"
                ),
                requiredInt(
                    call.getInt("remoteIdentityVersion"),
                    "e2ee_remote_identity_version_required"
                ),
                Boolean.TRUE.equals(call.getBoolean("revoked", false))
            );
            JSObject response = protocolResponse();
            response.put("invalidated", true);
            call.resolve(response);
        } catch (Exception error) {
            call.reject("e2ee_session_invalidation_failed", safeMessage(error), error);
        }
    }

    @PluginMethod
    public void storeTextMessage(PluginCall call) {
        try {
            requireProviderAvailable();
            String userId = requiredString(call, "userId", "e2ee_user_id_required");
            PulseE2eeMessageHistory.TextMessage message = new PulseE2eeMessageHistory.TextMessage(
                requiredString(call, "conversationId", "e2ee_conversation_id_required"),
                requiredString(call, "messageId", "e2ee_message_id_required"),
                optionalString(call, "clientMessageId"),
                requiredString(call, "senderUserId", "e2ee_sender_user_id_required"),
                requiredString(call, "senderDeviceId", "e2ee_sender_device_id_required"),
                requiredString(call, "messageType", "e2ee_message_type_required"),
                call.getString("plaintext"),
                requiredString(call, "createdAt", "e2ee_created_at_required")
            );
            int messageCount = messageHistory.store(userId, message);
            JSObject response = protocolResponse();
            response.put("stored", true);
            response.put("messageCount", messageCount);
            call.resolve(response);
        } catch (Exception error) {
            call.reject("e2ee_history_store_failed", safeMessage(error), error);
        }
    }

    @PluginMethod
    public void listTextMessages(PluginCall call) {
        try {
            requireProviderAvailable();
            String userId = requiredString(call, "userId", "e2ee_user_id_required");
            String conversationId = requiredString(
                call,
                "conversationId",
                "e2ee_conversation_id_required"
            );
            int limit = call.getInt("limit", 50);
            int offset = call.getInt("offset", 0);
            JSArray messages = new JSArray();
            for (
                PulseE2eeMessageHistory.TextMessage message
                : messageHistory.list(userId, conversationId, limit, offset)
            ) {
                JSObject value = new JSObject();
                value.put("conversationId", message.conversationId);
                value.put("messageId", message.messageId);
                if (message.clientMessageId != null) {
                    value.put("clientMessageId", message.clientMessageId);
                }
                value.put("senderUserId", message.senderUserId);
                value.put("senderDeviceId", message.senderDeviceId);
                value.put("messageType", message.messageType);
                value.put("plaintext", message.plaintext);
                value.put("createdAt", message.createdAt);
                messages.put(value);
            }
            JSObject response = protocolResponse();
            response.put("messages", messages);
            call.resolve(response);
        } catch (Exception error) {
            call.reject("e2ee_history_list_failed", safeMessage(error), error);
        }
    }

    @PluginMethod
    public void clearTextMessageHistory(PluginCall call) {
        try {
            requireProviderAvailable();
            int removedMessages = messageHistory.clear(
                requiredString(call, "userId", "e2ee_user_id_required"),
                requiredString(call, "conversationId", "e2ee_conversation_id_required")
            );
            JSObject response = protocolResponse();
            response.put("cleared", true);
            response.put("removedMessages", removedMessages);
            call.resolve(response);
        } catch (Exception error) {
            call.reject("e2ee_history_clear_failed", safeMessage(error), error);
        }
    }

    @PluginMethod
    public void clearUserState(PluginCall call) {
        String userId = call.getString("userId");
        if (userId == null) {
            call.reject("e2ee_user_id_required");
            return;
        }
        try {
            requireProviderAvailable();
            int removedRecords = secureStore.clearUser(userId);
            JSObject response = new JSObject();
            response.put("ok", true);
            response.put("removedRecords", removedRecords);
            call.resolve(response);
        } catch (Exception error) {
            call.reject("e2ee_secure_storage_clear_failed", safeMessage(error), error);
        }
    }

    private static boolean isProviderAvailable() {
        return PulseE2eeBuildGate.isProviderAvailable(
            BuildConfig.DEBUG,
            BuildConfig.PULSE_E2EE_QA_ENABLED,
            BuildConfig.PULSE_E2EE_PILOT_ENABLED
        );
    }

    private static void requireProviderAvailable() {
        if (!isProviderAvailable()) {
            throw new IllegalStateException("e2ee_provider_disabled");
        }
    }

    private static String safeMessage(Throwable error) {
        String message = error == null ? null : error.getMessage();
        return message == null || message.isBlank() ? "Onbekende fout" : message;
    }

    private static JSObject bootstrapResponse(
        PulseE2eeV2Provider.BootstrapResult result,
        PulseE2eeSecureStore.Capabilities storageCapabilities
    )
        throws Exception {
        JSObject response = protocolResponse();
        response.put("signalDeviceId", result.signalDeviceId);
        response.put("registrationId", result.registrationId);
        response.put("identityKey", encodeBase64(result.identityKey));
        response.put("signedPreKey", signedPreKey(
            result.signedPreKey.getId(),
            result.signedPreKey.getKeyPair().getPublicKey().serialize(),
            result.signedPreKey.getSignature()
        ));
        response.put("kyberPreKey", signedPreKey(
            result.kyberPreKey.getId(),
            result.kyberPreKey.getKeyPair().getPublicKey().serialize(),
            result.kyberPreKey.getSignature()
        ));
        JSArray preKeys = new JSArray();
        for (org.signal.libsignal.protocol.state.PreKeyRecord record : result.oneTimePreKeys) {
            JSObject value = new JSObject();
            value.put("keyId", record.getId());
            value.put("publicKey", encodeBase64(record.getKeyPair().getPublicKey().serialize()));
            preKeys.put(value);
        }
        response.put("oneTimePreKeys", preKeys);
        JSObject capabilities = new JSObject();
        capabilities.put("messageEncryption", true);
        capabilities.put("hardwareBackedKeystore", storageCapabilities.hardwareBacked);
        response.put("capabilities", capabilities);
        response.put("privateMaterialExportable", false);
        return response;
    }

    private static JSObject signedPreKey(int keyId, byte[] publicKey, byte[] signature) {
        JSObject value = new JSObject();
        value.put("keyId", keyId);
        value.put("publicKey", encodeBase64(publicKey));
        value.put("signature", encodeBase64(signature));
        return value;
    }

    private static JSObject envelopeResponse(PulseLibsignalSessionEngine.EncryptedEnvelope envelope) {
        JSObject response = protocolResponse();
        response.put("envelopeType", envelope.envelopeType);
        response.put("ciphertext", encodeBase64(envelope.ciphertext));
        return response;
    }

    private static JSObject protocolResponse() {
        JSObject response = new JSObject();
        response.put("protocol", "pulse_e2ee_v2");
        response.put("protocolVersion", 2);
        return response;
    }

    private static PulseLibsignalSessionEngine.PublicBundle decodePublicBundle(JSObject value) {
        JSObject signedPreKey = requiredObject(value, "signedPreKey");
        JSObject oneTimePreKey = requiredObject(value, "oneTimePreKey");
        JSObject kyberPreKey = requiredObject(value, "kyberPreKey");
        return new PulseLibsignalSessionEngine.PublicBundle(
            requiredInt(value.getInteger("registrationId"), "e2ee_registration_id_required"),
            requiredInt(value.getInteger("signalDeviceId"), "e2ee_signal_device_id_required"),
            decodeBase64(requiredString(value, "identityKey", "e2ee_identity_key_required")),
            requiredInt(signedPreKey.getInteger("keyId"), "e2ee_signed_prekey_id_required"),
            decodeBase64(requiredString(signedPreKey, "publicKey", "e2ee_signed_prekey_required")),
            decodeBase64(requiredString(signedPreKey, "signature", "e2ee_signed_prekey_signature_required")),
            requiredInt(oneTimePreKey.getInteger("keyId"), "e2ee_prekey_id_required"),
            decodeBase64(requiredString(oneTimePreKey, "publicKey", "e2ee_prekey_required")),
            requiredInt(kyberPreKey.getInteger("keyId"), "e2ee_kyber_prekey_id_required"),
            decodeBase64(requiredString(kyberPreKey, "publicKey", "e2ee_kyber_prekey_required")),
            decodeBase64(requiredString(kyberPreKey, "signature", "e2ee_kyber_prekey_signature_required"))
        );
    }

    private static JSObject requiredObject(JSObject value, String key) {
        JSObject result = value.getJSObject(key);
        if (result == null) throw new IllegalArgumentException("e2ee_" + key + "_required");
        return result;
    }

    private static String requiredString(PluginCall call, String key, String code) {
        String value = call.getString(key);
        if (value == null || value.isBlank()) throw new IllegalArgumentException(code);
        return value;
    }

    private static String optionalString(PluginCall call, String key) {
        String value = call.getString(key);
        return value == null || value.isBlank() ? null : value;
    }

    private static String requiredString(JSObject object, String key, String code) {
        String value = object.getString(key);
        if (value == null || value.isBlank()) throw new IllegalArgumentException(code);
        return value;
    }

    private static int requiredInt(Integer value, String code) {
        if (value == null) throw new IllegalArgumentException(code);
        return value;
    }

    private static String encodeBase64(byte[] value) {
        return Base64.encodeToString(value, Base64.NO_WRAP);
    }

    private static byte[] decodeBase64(String value) {
        try {
            return Base64.decode(value, Base64.DEFAULT);
        } catch (IllegalArgumentException error) {
            throw new IllegalArgumentException("e2ee_base64_invalid", error);
        }
    }
}
