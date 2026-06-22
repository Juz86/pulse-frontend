import React from 'react';

export default function FloatingComposer({
  children,
  className = '',
}) {
  return (
    <div className={`floating-composer${className ? ` ${className}` : ''}`}>
      {children}
    </div>
  );
}
