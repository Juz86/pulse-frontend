export function computeDeliveryState(receiptRecords = []) {
  if (!Array.isArray(receiptRecords) || receiptRecords.length === 0) {
    return 'sent';
  }

  if (receiptRecords.some((record) => !!record?.readAt)) {
    return 'read';
  }

  if (receiptRecords.some((record) => !!record?.deliveredAt)) {
    return 'delivered';
  }

  return 'sent';
}

export function toSocketStatus(deliveryState) {
  if (deliveryState === 'read') return 'gelezen';
  if (deliveryState === 'delivered') return 'bezorgd';
  return null;
}
