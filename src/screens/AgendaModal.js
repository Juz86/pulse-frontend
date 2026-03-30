// src/screens/AgendaModal.js
import React, { useEffect, useRef, useState } from 'react';

export default function AgendaModal({ mode, initial, onSave, onClose }) {
  const [title, setTitle] = useState(initial?.title || '');
  const [date,  setDate]  = useState(initial?.date  || '');
  const [time,  setTime]  = useState(initial?.time  || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const titleRef = useRef(null);

  useEffect(() => {
    titleRef.current?.focus();
    const prev = document.activeElement;
    return () => prev?.focus?.();
  }, []);

  useEffect(() => {
    const handleKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) { setError('Titel is verplicht.'); return; }
    if (!date)         { setError('Datum is verplicht.'); return; }
    setError('');
    setSaving(true);
    try {
      await onSave({ title: title.trim(), date, time: time || null });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="agenda-modal-backdrop" role="dialog" aria-modal="true" aria-label={mode === 'add' ? 'Activiteit toevoegen' : 'Activiteit bewerken'} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="agenda-modal">
        <div className="agenda-modal-header">
          <h2 className="agenda-modal-title">
            {mode === 'add' ? 'Activiteit toevoegen' : 'Activiteit bewerken'}
          </h2>
          <button type="button" className="agenda-modal-close" aria-label="Sluiten" onClick={onClose}>✕</button>
        </div>

        <form className="agenda-modal-form" onSubmit={handleSubmit} noValidate>
          <div className="agenda-field">
            <label htmlFor="agenda-title" className="agenda-label">Titel</label>
            <input
              ref={titleRef}
              id="agenda-title"
              type="text"
              className="agenda-input"
              placeholder="bijv. Rekentoets"
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={80}
              required
            />
          </div>

          <div className="agenda-field">
            <label htmlFor="agenda-date" className="agenda-label">Datum</label>
            <input
              id="agenda-date"
              type="date"
              className="agenda-input"
              value={date}
              onChange={e => setDate(e.target.value)}
              required
            />
          </div>

          <div className="agenda-field">
            <label htmlFor="agenda-time" className="agenda-label">
              Tijd <span className="agenda-label-optional">(optioneel)</span>
            </label>
            <input
              id="agenda-time"
              type="time"
              className="agenda-input"
              value={time}
              onChange={e => setTime(e.target.value)}
            />
          </div>

          {error && <p className="agenda-field-error" role="alert">{error}</p>}

          <div className="agenda-modal-actions">
            <button type="button" className="agenda-btn-cancel" onClick={onClose} disabled={saving}>
              Annuleren
            </button>
            <button type="submit" className="agenda-btn-save" disabled={saving}>
              {saving ? 'Opslaan…' : 'Opslaan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
