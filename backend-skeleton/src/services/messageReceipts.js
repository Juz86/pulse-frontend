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

export function toSocketStatus(deliveryState) {
  if (deliveryState === 'read') return 'gelezen';
  if (deliveryState === 'delivered') return 'bezorgd';
  return null;
}
