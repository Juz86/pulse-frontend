import { io as createClient } from 'socket.io-client';

const baseUrl = process.env.BACKEND_BASE_URL || 'http://127.0.0.1:3001';
const convId = process.env.SMOKE_CONVERSATION_ID || 'conv_1';
const senderUid = process.env.SMOKE_SENDER_UID || 'uid_child_1';
const recipientUid = process.env.SMOKE_RECIPIENT_UID || 'uid_contact_9';
const senderDeviceId = process.env.SMOKE_SENDER_DEVICE_ID || 'device_child_1';
const recipientDeviceId = process.env.SMOKE_RECIPIENT_DEVICE_ID || 'device_contact_9';

function waitForEvent(socket, event, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error(`timeout_waiting_for_${event}`));
    }, timeoutMs);

    function onEvent(payload) {
      clearTimeout(timer);
      socket.off(event, onEvent);
      resolve(payload);
    }

    socket.on(event, onEvent);
  });
}

function connectDevSocket(devUid) {
  return new Promise((resolve, reject) => {
    const socket = createClient(baseUrl, {
      transports: ['websocket'],
      auth: { devUid },
      forceNew: true,
      reconnection: false,
    });

    const timer = setTimeout(() => {
      socket.close();
      reject(new Error(`timeout_connecting_${devUid}`));
    }, 5000);

    socket.once('connect', () => {
      clearTimeout(timer);
      resolve(socket);
    });

    socket.once('connect_error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

async function postJson(path, body, devUid) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-dev-uid': devUid,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`${path}:${response.status}:${JSON.stringify(data)}`);
  }

  return data;
}

async function main() {
  const senderSocket = await connectDevSocket(senderUid);
  const recipientSocket = await connectDevSocket(recipientUid);

  try {
    senderSocket.emit('conversation:join', { convId });
    recipientSocket.emit('conversation:join', { convId });

    const incomingMessagePromise = waitForEvent(recipientSocket, 'message:new');

    const sendResult = await postJson('/messages/send', {
      conversationId: convId,
      senderDeviceId,
      ciphertext: Buffer.from(`socket-smoke-${Date.now()}`).toString('base64'),
      messageType: 'text',
      protocol: 'signal_v1',
      protocolVersion: 1,
      replyToMessageId: null,
      recipientPayloads: [
        {
          recipientUserId: recipientUid,
          recipientDeviceId,
          encryptedMessageKey: Buffer.from('socket-smoke-emk').toString('base64'),
        },
      ],
    }, senderUid);

    const incomingMessage = await incomingMessagePromise;
    if (incomingMessage.id !== sendResult.messageId) {
      throw new Error(`unexpected_message_id:${incomingMessage.id}`);
    }

    const senderStatusPromise = waitForEvent(senderSocket, 'message:status');

    await postJson('/messages/receipt', {
      messageId: sendResult.messageId,
      recipientDeviceId,
      type: 'read',
    }, recipientUid);

    const senderStatus = await senderStatusPromise;
    if (senderStatus.msgId !== sendResult.messageId) {
      throw new Error(`unexpected_status_msg:${senderStatus.msgId}`);
    }

    console.log(JSON.stringify({
      ok: true,
      messageId: sendResult.messageId,
      incomingEvent: {
        event: 'message:new',
        recipientUid,
      },
      statusEvent: {
        event: 'message:status',
        status: senderStatus.status,
        deliveryState: senderStatus.deliveryState,
      },
    }));
  } finally {
    senderSocket.close();
    recipientSocket.close();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
