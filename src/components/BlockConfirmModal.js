import React from 'react';

export default function BlockConfirmModal({ contactName, onConfirm, onCancel }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="block-modal-title" onClick={onCancel}>
      <div className="modal-card block-confirm-modal" onClick={e => e.stopPropagation()}>
        <h2 id="block-modal-title">Contact blokkeren</h2>
        <p>
          Weet je zeker dat je <strong>{contactName}</strong> wilt blokkeren?
          Ze kunnen je dan geen berichten meer sturen of bellen.
        </p>
        <div className="block-confirm-actions">
          <button type="button" className="btn-secondary" onClick={onCancel}>Annuleren</button>
          <button type="button" className="btn-danger" onClick={onConfirm}>Blokkeren</button>
        </div>
      </div>
    </div>
  );
}
