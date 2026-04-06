import React from 'react';

export default function SystemMessageNote({ text }) {
  return (
    <div className="msg-group system" role="listitem">
      <div
        className="msg-system-note"
        style={{
          alignSelf: 'center',
          maxWidth: '85%',
          padding: '8px 12px',
          borderRadius: 999,
          background: 'rgba(255,255,255,0.06)',
          color: 'var(--text3)',
          fontSize: 12,
          lineHeight: 1.4,
          textAlign: 'center',
        }}
      >
        {text}
      </div>
    </div>
  );
}
