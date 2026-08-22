import React, { useEffect, useRef, useState } from 'react';
import { Cancel } from './Icons';

/** A single, mobile-first confirmation pattern for potentially consequential actions. */
export default function PulseConfirmSheet({
  title = 'Bevestiging',
  description,
  actions = [],
  children,
  onClose,
  dismissible = true,
  tone = 'default',
}) {
  const [isClosing, setIsClosing] = useState(false);
  const closeTimerRef = useRef(null);

  const closeSheet = (event) => {
    // Een bevestigingssheet kan via een portal boven een zijbalkpagina staan.
    // Sluiten mag uitsluitend deze tijdelijke laag sluiten, nooit de pagina eronder.
    event?.stopPropagation();
    if (isClosing) return;
    setIsClosing(true);
    closeTimerRef.current = window.setTimeout(() => onClose?.(), 180);
  };

  useEffect(() => () => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
  }, []);

  useEffect(() => {
    if (!dismissible) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [dismissible, onClose]);

  return (
    <div
      className={`pulse-confirm-backdrop pulse-confirm-backdrop--${tone}${isClosing ? ' is-closing' : ''}`}
      onClick={(event) => {
        // This sheet can be rendered from a nested sidebar page. Keep its
        // close action local so a click never also closes that underlying page.
        if (dismissible) closeSheet(event);
        else event.stopPropagation();
      }}
    >
      <aside
        className={`pulse-confirm-sheet pulse-confirm-sheet--${tone}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pulse-confirm-title"
        aria-describedby={description ? 'pulse-confirm-description' : undefined}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="pulse-confirm-handle" aria-hidden="true" />
        <div className="pulse-confirm-heading">
          <h2 id="pulse-confirm-title">{title}</h2>
          {dismissible && (
            <button type="button" className="pulse-confirm-close" aria-label="Sluiten" onClick={closeSheet}>
              <Cancel size={28} aria-hidden="true" />
            </button>
          )}
        </div>
        {description && <p id="pulse-confirm-description" className="pulse-confirm-description">{description}</p>}
        {children && <div className="pulse-confirm-extra">{children}</div>}
        {actions.filter(Boolean).length > 0 && (
          <div className="pulse-confirm-actions">
            {actions.filter(Boolean).map((action, index) => {
            const Icon = action.icon;
            return (
              <button
                key={`${action.label}-${index}`}
                type="button"
                className={`pulse-confirm-action pulse-confirm-action--${action.tone || 'neutral'}`}
                onClick={action.onSelect}
                disabled={action.disabled}
              >
                {Icon && <Icon size={24} aria-hidden="true" />}
                <span className="pulse-confirm-action-copy">
                  <span className="pulse-confirm-action-label">{action.label}</span>
                  {action.description && <span className="pulse-confirm-action-description">{action.description}</span>}
                </span>
              </button>
            );
            })}
          </div>
        )}
      </aside>
    </div>
  );
}
