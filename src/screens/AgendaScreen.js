// src/screens/AgendaScreen.js
import React, { useEffect, useRef, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';
import { BACKEND_URL as BACKEND } from '../services/socket';
import { Calendar, MagicEdit, Delete, Cancel } from '../components/Icons';
import AgendaModal from './AgendaModal';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('nl-NL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function isToday(dateStr) {
  const today = new Date().toISOString().slice(0, 10);
  return dateStr === today;
}

function isPast(dateStr) {
  const today = new Date().toISOString().slice(0, 10);
  return dateStr < today;
}

export default function AgendaScreen({ user }) {
  const [activities, setActivities]     = useState([]);
  const [loading, setLoading]           = useState(true);
  const [modal, setModal]               = useState(null); // null | { mode: 'add' } | { mode: 'edit', activity }
  const [deleteConfirm, setDeleteConfirm] = useState(null); // activity | null
  const [toast, setToast]               = useState('');
  const toastTimer                      = useRef(null);

  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 4000);
  }

  // Real-time Firestore listener
  useEffect(() => {
    const q = query(
      collection(db, 'agenda', user.uid, 'activities'),
      orderBy('date', 'asc'),
    );
    const unsub = onSnapshot(q, snap => {
      setActivities(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [user.uid]);

  async function authFetch(url, options = {}) {
    const token = await user.getIdToken();
    return fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async function handleSave({ title, date, time }) {
    try {
      if (modal.mode === 'add') {
        await authFetch(`${BACKEND}/api/agenda/${user.uid}`, {
          method: 'POST',
          body: JSON.stringify({ title, date, time }),
        });
        showToast(`'${title}' toegevoegd aan je agenda.`);
      } else {
        await authFetch(`${BACKEND}/api/agenda/${user.uid}/${modal.activity.id}`, {
          method: 'PUT',
          body: JSON.stringify({ title, date, time }),
        });
        showToast(`'${title}' bijgewerkt.`);
      }
      setModal(null);
    } catch {
      showToast('Er ging iets mis. Probeer het opnieuw.');
    }
  }

  async function handleDelete(activity) {
    try {
      await authFetch(`${BACKEND}/api/agenda/${user.uid}/${activity.id}`, { method: 'DELETE' });
      setDeleteConfirm(null);
      showToast(`'${activity.title}' verwijderd.`);
    } catch {
      showToast('Er ging iets mis. Probeer het opnieuw.');
    }
  }

  // Groepeer: vandaag bovenaan, daarna de rest
  const today    = activities.filter(a => isToday(a.date));
  const upcoming = activities.filter(a => !isToday(a.date) && !isPast(a.date));
  const past     = activities.filter(a => isPast(a.date));

  return (
    <div className="agenda-screen">
      {/* Header */}
      <div className="agenda-header">
        <div className="agenda-header-title">
          <Calendar size={20} aria-hidden="true" />
          <span>Mijn agenda</span>
        </div>
        <button
          type="button"
          className="agenda-add-btn"
          onClick={() => setModal({ mode: 'add' })}
          aria-label="Activiteit toevoegen"
        >
          + Toevoegen
        </button>
      </div>

      {/* Content */}
      <div className="agenda-content">
        {loading && (
          <div className="agenda-empty">
            <span className="agenda-empty-icon" aria-hidden="true">📅</span>
            <p>Agenda laden…</p>
          </div>
        )}

        {!loading && activities.length === 0 && (
          <div className="agenda-empty">
            <span className="agenda-empty-icon" aria-hidden="true">📅</span>
            <p className="agenda-empty-title">Je hebt nog geen activiteiten.</p>
            <p className="agenda-empty-sub">Voeg je eerste toe!</p>
            <button
              type="button"
              className="agenda-add-btn"
              onClick={() => setModal({ mode: 'add' })}
            >
              + Eerste activiteit toevoegen
            </button>
          </div>
        )}

        {!loading && today.length > 0 && (
          <div className="agenda-group">
            <div className="agenda-group-label agenda-group-label--today">Vandaag</div>
            {today.map(a => (
              <ActivityCard
                key={a.id}
                activity={a}
                highlight
                onEdit={() => setModal({ mode: 'edit', activity: a })}
                onDelete={() => setDeleteConfirm(a)}
              />
            ))}
          </div>
        )}

        {!loading && upcoming.length > 0 && (
          <div className="agenda-group">
            {today.length > 0 && <div className="agenda-group-label">Aankomend</div>}
            {upcoming.map(a => (
              <ActivityCard
                key={a.id}
                activity={a}
                onEdit={() => setModal({ mode: 'edit', activity: a })}
                onDelete={() => setDeleteConfirm(a)}
              />
            ))}
          </div>
        )}

        {!loading && past.length > 0 && (
          <div className="agenda-group">
            <div className="agenda-group-label agenda-group-label--past">Verlopen</div>
            {past.map(a => (
              <ActivityCard
                key={a.id}
                activity={a}
                past
                onEdit={() => setModal({ mode: 'edit', activity: a })}
                onDelete={() => setDeleteConfirm(a)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {modal && (
        <AgendaModal
          mode={modal.mode}
          initial={modal.activity}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      {deleteConfirm && (
        <div className="agenda-dialog-backdrop" role="dialog" aria-modal="true" onClick={() => setDeleteConfirm(null)}>
          <div className="agenda-dialog" onClick={e => e.stopPropagation()}>
            <p className="agenda-dialog-text">
              Weet je zeker dat je <strong>'{deleteConfirm.title}'</strong> wilt verwijderen?
            </p>
            <div className="agenda-dialog-actions">
              <button type="button" className="agenda-btn-cancel" onClick={() => setDeleteConfirm(null)}>
                Annuleren
              </button>
              <button type="button" className="agenda-btn-danger" onClick={() => handleDelete(deleteConfirm)}>
                Verwijderen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="agenda-toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </div>
  );
}

function ActivityCard({ activity, highlight, past, onEdit, onDelete }) {
  return (
    <div className={`agenda-card${highlight ? ' agenda-card--today' : ''}${past ? ' agenda-card--past' : ''}`}>
      <div className="agenda-card-date">{formatDate(activity.date)}</div>
      <div className="agenda-card-title">{activity.title}</div>
      {activity.time && (
        <div className="agenda-card-time">{activity.time}</div>
      )}
      <div className="agenda-card-actions">
        <button
          type="button"
          className="agenda-icon-btn"
          aria-label={`Bewerk ${activity.title}`}
          onClick={onEdit}
        >
          <MagicEdit size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="agenda-icon-btn agenda-icon-btn--danger"
          aria-label={`Verwijder ${activity.title}`}
          onClick={onDelete}
        >
          <Delete size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
