export function computeDeliveryState(receiptRecords = []) {
  if (!Array.isArray(receiptRecords) || receiptRecords.length === 0) {
    return 'sent';
  }

  const relevantRecords = receiptRecords.filter(Boolean);
  if (relevantRecords.length === 0) {
    return 'sent';
  }

  if (relevantRecords.every((record) => !!record?.readAt)) {
    return 'read';
  }

  if (relevantRecords.every((record) => !!record?.deliveredAt || !!record?.readAt)) {
    return 'delivered';
  }

  return 'sent';
}

export function computeReceiptSummary(receiptRecords = []) {
  if (!Array.isArray(receiptRecords) || receiptRecords.length === 0) {
    return {
      recipientCount: 0,
      deliveredCount: 0,
      readCount: 0,
    };
  }

  const byUser = new Map();

  for (const record of receiptRecords.filter(Boolean)) {
    const recipientUserId = record?.recipientUserId;
    if (!recipientUserId) continue;

    if (!byUser.has(recipientUserId)) {
      byUser.set(recipientUserId, []);
    }

    byUser.get(recipientUserId).push(record);
  }

  let deliveredCount = 0;
  let readCount = 0;

  for (const userRecords of byUser.values()) {
    if (userRecords.length > 0 && userRecords.every((record) => !!record?.readAt)) {
      readCount += 1;
      deliveredCount += 1;
      continue;
    }

    if (userRecords.length > 0 && userRecords.every((record) => !!record?.deliveredAt || !!record?.readAt)) {
      deliveredCount += 1;
    }
  }

  return {
    recipientCount: byUser.size,
    deliveredCount,
    readCount,
  };
}

export function toSocketStatus(deliveryState) {
  if (deliveryState === 'read') return 'gelezen';
  if (deliveryState === 'delivered') return 'bezorgd';
  return null;
}
