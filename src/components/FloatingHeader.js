import React from 'react';

export default function FloatingHeader({
  leading = null,
  title,
  subtitle = null,
  meta = null,
  actions = null,
  className = '',
  titleClassName = '',
  compact = false,
}) {
  return (
    <div className={`floating-header${compact ? ' floating-header--compact' : ''}${className ? ` ${className}` : ''}`}>
      {leading ? <div className="floating-header__leading">{leading}</div> : null}
      <div className="floating-header__content">
        {meta ? <div className="floating-header__meta">{meta}</div> : null}
        <div className={`floating-header__title${titleClassName ? ` ${titleClassName}` : ''}`}>{title}</div>
        {subtitle ? <div className="floating-header__subtitle">{subtitle}</div> : null}
      </div>
      {actions ? <div className="floating-header__actions">{actions}</div> : null}
    </div>
  );
}
