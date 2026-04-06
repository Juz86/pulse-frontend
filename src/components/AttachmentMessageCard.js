import React from 'react';
import { formatTime } from '../utils';

function AttachmentMessageBody({ bodyPresentation }) {
  return (
    <>
      <div className="u-fw-600 u-fs-14 u-ellipsis">{bodyPresentation.title}</div>
      <div className="u-fs-12 u-ellipsis" style={bodyPresentation.subtitleStyle}>
        {bodyPresentation.subtitle}
      </div>
      {bodyPresentation.details.map((line) => (
        <div
          key={line.key}
          className={line.className}
          style={line.style}
        >
          {line.text}
        </div>
      ))}
      {bodyPresentation.errorText && (
        <div
          className="u-fs-12"
          style={bodyPresentation.errorStyle}
        >
          {bodyPresentation.errorText}
        </div>
      )}
      {bodyPresentation.actionsPresentation?.buttons?.length ? (
        <div style={bodyPresentation.actionsPresentation.rowStyle}>
          {bodyPresentation.actionsPresentation.buttons.map((button) => (
            <button
              key={button.key}
              type="button"
              className="icon-btn"
              disabled={button.disabled}
              onClick={button.props.onClick}
              style={button.style}
            >
              {button.label}
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
}

export default function AttachmentMessageCard({ presentation, createdAt }) {
  const {
    bodyLayout,
    body,
    cardInteraction,
    card,
    variant,
    timestampStyle,
  } = presentation;

  return (
    <div
      className="msg-contact-card"
      role={card.role}
      tabIndex={card.tabIndex}
      aria-label={card.ariaLabel}
      style={cardInteraction.style}
      onClick={cardInteraction.onClick}
      onKeyDown={cardInteraction.onKeyDown}
    >
      {variant.showsImagePreview ? (
        <div className={bodyLayout.wrapperClassName}>
          <img
            src={bodyLayout.preview.src}
            alt={bodyLayout.preview.alt}
            style={bodyLayout.preview.style}
            loading="lazy"
          />
          <AttachmentMessageBody bodyPresentation={body} />
        </div>
      ) : (
        <>
          {bodyLayout.fileBadge && (
            <div
              className="avatar-circle sm u-flex-shrink"
              style={bodyLayout.fileBadge.style}
              aria-hidden="true"
            >
              {bodyLayout.fileBadge.label}
            </div>
          )}
          <div className={bodyLayout.wrapperClassName}>
            <AttachmentMessageBody bodyPresentation={body} />
          </div>
        </>
      )}
      <div className="u-flex-shrink" style={timestampStyle}>
        {formatTime(createdAt)}
      </div>
    </div>
  );
}
