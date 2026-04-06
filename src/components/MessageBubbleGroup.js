import React from 'react';

export default function MessageBubbleGroup({ isOwn, children }) {
  return (
    <div className={`msg-group ${isOwn ? 'out' : 'in'}`} role="listitem">
      {children}
    </div>
  );
}
