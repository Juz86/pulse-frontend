import React from 'react';

const FloatingIconButton = React.forwardRef(function FloatingIconButton({
  children,
  className = '',
  tone = 'default',
  badge = null,
  ...props
}, ref) {
  return (
    <button
      ref={ref}
      type="button"
      className={`floating-icon-btn floating-icon-btn--${tone}${className ? ` ${className}` : ''}`}
      {...props}
    >
      <span className="floating-icon-btn__icon" aria-hidden="true">{children}</span>
      {badge ? <span className="floating-icon-btn__badge" aria-hidden="true">{badge}</span> : null}
    </button>
  );
});

export default FloatingIconButton;
