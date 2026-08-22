import React from 'react';

export function ProfilePageShell({
  panelRef,
  titleId,
  title,
  description,
  hideTitle = false,
  onBack,
  backLabel = 'Terug',
  headerAction = null,
  hero = null,
  scrollContent = false,
  navigationVariant = 'page',
  children,
  className = 'chat-side-panel contact-profile-panel',
  panelProps = {},
}) {
  return (
    <aside
      ref={panelRef}
      className={`${className}${scrollContent ? ' profile-page-shell--scroll' : ''} pulse-navigation pulse-navigation--${navigationVariant}`}
      aria-labelledby={hideTitle ? undefined : titleId}
      aria-label={hideTitle ? title : undefined}
      aria-describedby={`${titleId}-description`}
      {...panelProps}
    >
      <div className="contact-profile-topbar">
        <button
          type="button"
          className="contact-profile-nav-btn"
          aria-label={backLabel}
          title="Terug"
          onClick={onBack}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        {!hideTitle && <h2 id={titleId} className="contact-profile-heading">{title}</h2>}
        {headerAction || <span className="contact-profile-topbar-spacer" aria-hidden="true" />}
      </div>
      <p id={`${titleId}-description`} className="sr-only">{description}</p>
      {scrollContent ? (
        <div className="profile-page-scroll-content">
          {hero}
          {children}
        </div>
      ) : (
        <>
          {hero}
          {children}
        </>
      )}
    </aside>
  );
}

export function ProfilePageHero({
  avatar,
  name,
  nameEditor = null,
  subtitle = null,
  belowSubtitle = null,
  status = null,
  className = 'contact-profile-hero',
  children = null,
}) {
  return (
    <div className={className}>
      {avatar ? <div className="contact-profile-avatar-shell">{avatar}</div> : null}
      {(name || subtitle || belowSubtitle || status) ? (
        <div className="contact-profile-hero-copy">
          {nameEditor || (name ? <div className="contact-profile-name">{name}</div> : null)}
          {subtitle ? <div className="contact-profile-subtitle">{subtitle}</div> : null}
          {belowSubtitle}
          {status}
        </div>
      ) : null}
      {children}
    </div>
  );
}
