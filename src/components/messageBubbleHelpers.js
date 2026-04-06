import React from 'react';

export function getMessageStatusInfo(msg) {
  if (msg.failed) return { icon: 'cancel', label: 'Mislukt', failed: true };
  if (msg.pending) return { icon: 'clock', label: 'verstuurd', failed: false };
  if (msg.deliveryState === 'read') return { icon: 'double', label: 'gelezen', read: true };
  if (msg.deliveryState === 'delivered') return { icon: 'double', label: 'bezorgd', read: false };
  if (msg.deliveryState === 'failed') return { icon: 'cancel', label: 'Mislukt', failed: true };
  if (msg.deliveryState === 'sending') return { icon: 'clock', label: 'verstuurd', failed: false };
  if (msg.status === 'gelezen') return { icon: 'double', label: 'gelezen', read: true };
  if (msg.status === 'bezorgd') return { icon: 'double', label: 'bezorgd', read: false };
  return { icon: 'check', label: 'verstuurd', failed: false };
}

export function getMessageReceiptSummaryLabel(msg, isGroup) {
  if (!isGroup || !msg?.receiptSummary || !msg?.isOwn) return '';

  const {
    recipientCount = 0,
    deliveredCount = 0,
    readCount = 0,
  } = msg.receiptSummary;

  if (!recipientCount) return '';
  if (readCount > 0) return `gelezen door ${readCount}/${recipientCount}`;
  if (deliveredCount > 0) return `bezorgd bij ${deliveredCount}/${recipientCount}`;
  return '';
}

export function renderMessageTextWithMentions(text, mentions, memberNames) {
  const parts = text.split(/(@\S+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('@') && mentions?.length) {
      const name = part.slice(1).replace(/[^\w\s]/g, '');
      const matched = mentions.find(
        uid => (memberNames?.[uid] || '').toLowerCase() === name.toLowerCase()
      );
      if (matched) return <span key={i} className="mention-tag">{part}</span>;
    }
    return part;
  });
}

export function highlightMessageSearch(text, query) {
  if (!query.trim()) return text;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} style={{ background: '#f59e0b', color: '#000', borderRadius: '2px', padding: '0 1px' }}>{part}</mark>
      : part
  );
}
