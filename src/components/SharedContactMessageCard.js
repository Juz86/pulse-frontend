import React from 'react';
import { getInitials, formatTime } from '../utils';

export default function SharedContactMessageCard({
  presentation,
  onViewContact,
  onActionCardKeyDown,
}) {
  const {
    contact,
    isOwn,
    createdAt,
  } = presentation;
  const canOpenSharedContact = !isOwn;

  return (
    <div
      className="msg-contact-card"
      role={canOpenSharedContact ? 'button' : undefined}
      tabIndex={canOpenSharedContact ? 0 : undefined}
      aria-label={canOpenSharedContact ? `Open gedeeld contact ${contact?.name || 'Contactpersoon'}` : undefined}
      style={{ cursor: canOpenSharedContact ? 'pointer' : 'default' }}
      onClick={canOpenSharedContact ? () => onViewContact(contact) : undefined}
      onKeyDown={canOpenSharedContact ? (event) => onActionCardKeyDown(event, () => onViewContact(contact)) : undefined}
    >
      <div className="avatar-circle sm u-flex-shrink" style={{ borderRadius: 12 }} aria-hidden="true">
        {getInitials(contact?.name || '')}
      </div>
      <div className="u-flex-1 u-min-w-0">
        <div className="u-fw-600 u-fs-14 u-ellipsis">{contact?.name || 'Contactpersoon'}</div>
        {contact?.email && (
          <div className="u-fs-12 u-ellipsis" style={{ color: isOwn ? 'rgba(255,255,255,.65)' : 'var(--text3)' }}>
            {contact.email}
          </div>
        )}
      </div>
      <div
        className="u-flex-shrink"
        style={{ fontSize: '11px', color: isOwn ? 'rgba(255,255,255,.5)' : 'var(--text3)', alignSelf: 'flex-end' }}
      >
        {formatTime(createdAt)}
      </div>
    </div>
  );
}
