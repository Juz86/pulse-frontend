import React from 'react';

export default function SoftMessageBubble({
  isOwn = false,
  isFocused = false,
  className = '',
  children,
  ...props
}) {
  return (
    <div
      className={`soft-message-bubble${isOwn ? ' soft-message-bubble--own' : ' soft-message-bubble--incoming'}${isFocused ? ' soft-message-bubble--focused' : ''}${className ? ` ${className}` : ''}`}
      {...props}
    >
      {children}
    </div>
  );
}
