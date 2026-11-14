import React from 'react';

export default function PulseIconButton({
  Icon,
  label,
  title = label,
  variant = 'secondary',
  size = 22,
  className = '',
  children,
  type = 'button',
  ...props
}) {
  return (
    <button
      {...props}
      type={type}
      className={`pulse-icon-button pulse-icon-button--${variant}${className ? ` ${className}` : ''}`}
      aria-label={label}
      title={title}
    >
      {Icon ? <Icon size={size} aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
