import { BACKEND_URL } from '../../../services/socket';
import {
  PULSE_E2EE_V2_PROTOCOL,
  PULSE_E2EE_V2_VERSION,
  V2ContractValidationError,
  assertValidV2DeviceRegistration,
  assertValidV2MessageSend,
  validateV2KeyBundleClaim,
  validateV2KeyBundleClaimRequest,
  validateV2MessageDelivery,
} from './protocolV2Contract';

export class V2ApiError extends Error {
  constructor(code, status = 0) {
    super(code || 'v2_request_failed');
    this.name = 'V2ApiError';
    this.code = code || 'v2_request_failed';
    this.status = status;
  }
}

function protocolBody(body = {}) {
  return {
    protocol: PULSE_E2EE_V2_PROTOCOL,
    protocolVersion: PULSE_E2EE_V2_VERSION,
    ...body,
  };
}

function assertContract(result) {
  if (!result.ok) throw new V2ContractValidationError(result.errors);
}

function requireUser(user) {
  if (!user?.uid || typeof user.getIdToken !== 'function') {
    throw new V2ApiError('v2_auth_required');
  }
  return user;
}

function requireId(value) {
  const normalized = String(value || '');
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(normalized)) {
    throw new V2ApiError('v2_client_id_invalid');
  }
  return normalized;
}

function pathSegment(value) {
  return encodeURIComponent(requireId(value));
}

export function createV2ApiClient({
  baseUrl = BACKEND_URL,
  fetchImpl = (...args) => fetch(...args),
} = {}) {
  const root = String(baseUrl || '').replace(/\/$/, '');

  async function request(user, path, { method = 'GET', body } = {}) {
    const authenticatedUser = requireUser(user);
    const token = await authenticatedUser.getIdToken();
    const response = await fetchImpl(`${root}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new V2ApiError(payload?.error || 'v2_request_failed', response.status);
    }
    return payload;
  }

  return Object.freeze({
    async listDevices(user) {
      const payload = await request(user, '/v2/devices');
      return Array.isArray(payload?.devices) ? payload.devices : [];
    },

    async registerDevice(user, registration) {
      const body = assertValidV2DeviceRegistration(protocolBody(registration));
      return request(user, '/v2/devices/register', { method: 'POST', body });
    },

    async claimRecipientBundles(user, {
      conversationId,
      recipientUserId,
      requesterDeviceId,
      claimId,
    }) {
      const body = protocolBody({ requesterDeviceId, claimId });
      assertContract(validateV2KeyBundleClaimRequest(body, {
        authenticatedDeviceId: requesterDeviceId,
      }));
      const payload = await request(
        user,
        `/v2/conversations/${pathSegment(conversationId)}/users/${pathSegment(recipientUserId)}/key-bundles/claim`,
        { method: 'POST', body },
      );
      assertContract(validateV2KeyBundleClaim(payload, {
        authorized: true,
        expectedRecipientUserId: recipientUserId,
        expectedRecipientDeviceIds: (payload?.devices || []).map((device) => device.deviceId),
      }));
      return payload;
    },

    async claimOwnDeviceBundles(user, {
      conversationId,
      requesterDeviceId,
      claimId,
    }) {
      const body = protocolBody({ requesterDeviceId, claimId });
      assertContract(validateV2KeyBundleClaimRequest(body, {
        authenticatedDeviceId: requesterDeviceId,
      }));
      const payload = await request(
        user,
        `/v2/conversations/${pathSegment(conversationId)}/own-device-key-bundles/claim`,
        { method: 'POST', body },
      );
      assertContract(validateV2KeyBundleClaim(payload, {
        authorized: true,
        allowEmptyDevices: true,
        expectedRecipientUserId: user.uid,
        expectedRecipientDeviceIds: (payload?.devices || []).map((device) => device.deviceId),
      }));
      return payload;
    },

    async sendMessage(user, message, expectedRecipientDevices) {
      const body = protocolBody(message);
      assertValidV2MessageSend(body, {
        authenticatedDeviceId: message.senderDeviceId,
        expectedRecipientDevices,
      });
      return request(user, '/v2/messages/send', { method: 'POST', body });
    },

    async fetchEnvelope(user, { conversationId, messageId, deviceId }) {
      const validatedDeviceId = requireId(deviceId);
      const query = new URLSearchParams({ deviceId: validatedDeviceId });
      const payload = await request(
        user,
        `/v2/conversations/${pathSegment(conversationId)}/messages/${pathSegment(messageId)}/envelope?${query}`,
      );
      assertContract(validateV2MessageDelivery(payload, {
        authenticatedUserId: user.uid,
        authenticatedDeviceId: validatedDeviceId,
      }));
      return payload;
    },
  });
}

export const v2ApiClient = createV2ApiClient();
