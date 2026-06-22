import React from 'react';

export default function FilterChipPill({
  active = false,
  children,
  className = '',
  ...props
}) {
  return (
    <button
      type="button"
      className={`filter-chip-pill${active ? ' active' : ''}${className ? ` ${className}` : ''}`}
      aria-pressed={active}
      {...props}
    >
      {children}
    </button>
  );
}
