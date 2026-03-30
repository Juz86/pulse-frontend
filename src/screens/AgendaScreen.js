// src/screens/AgendaScreen.js
import React, { useEffect, useRef, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';
import { BACKEND_URL as BACKEND } from '../services/socket';
import { Calendar, MagicEdit, Delete } from '../components/Icons';
import AgendaModal from './AgendaModal';

const DAY_LABELS = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];
const MONTH_NAMES = ['Januari','Februari','Maart','April','Mei','Juni','Juli','Augustus','September','Oktober','November','December'];

function toISO(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('nl-NL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function isToday(dateStr) {
  return dateStr === new Date().toISOString().slice(0, 10);
}

function isPast(dateStr) {
  return dateStr < new Date().toISOString().slice(0, 10);
}

// Geeft de maandagrens terug: array van {day, dateStr, inMonth}
function buildCalendarDays(year, month) {
  const firstDay = new Date(year, month, 1);
  // Maandag = 0 … Zondag = 6
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];

  for (let i = 0; i < startOffset; i++) {
    const d = new Date(year, month, -startOffset + i + 1);
    cells.push({ day: d.getDate(), dateStr: toISO(d.getFullYear(), d.getMonth(), d.getDate()), inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, dateStr: toISO(year, month, d), inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const d = new Date(year, month + 1, cells.length - startOffset - daysInMonth + 1);
    cells.push({ day: d.getDate(), dateStr: toISO(d.getFullYear(), d.getMonth(), d.getDate()), inMonth: false });
  }
  return cells;
}

function MiniCalendar({ activities, selectedDate, onSelectDate }) {
  const now = new Date();
  const [viewYear,  setViewYear]  = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const activityDates = new Set(activities.map(a => a.date));
  const cells = buildCalendarDays(viewYear, viewMonth);

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  return (
    <div className="agenda-cal">
      {/* Navigatie */}
      <div className="agenda-cal-nav">
        <button type="button" className="agenda-cal-arrow" onClick={prevMonth} aria-label="Vorige maand">‹</button>
        <span className="agenda-cal-month">{MONTH_NAMES[viewMonth]} {viewYear}</span>
        <button type="button" className="agenda-cal-arrow" onClick={nextMonth} aria-label="Volgende maand">›</button>
      </div>

      {/* Dagkoppen */}
      <div className="agenda-cal-grid">
        {DAY_LABELS.map(l => (
          <div key={l} className="agenda-cal-head">{l}</div>
        ))}

        {/* Dagen */}
        {cells.map(({ day, dateStr, inMonth }) => {
          const today    = isToday(dateStr);
          const selected = dateStr === selectedDate;
          const hasDot   = activityDates.has(dateStr);
          return (
            <button
              key={dateStr}
              type="button"
              className={[
                'agenda-cal-day',
                !inMonth  ? 'agenda-cal-day--out'      : '',
                today     ? 'agenda-cal-day--today'    : '',
                selected  ? 'agenda-cal-day--selected' : '',
              ].join(' ').trim()}
              aria-label={`${day} ${MONTH_NAMES[viewMonth]}${hasDot ? ', heeft activiteiten' : ''}`}
              aria-pressed={selected}
              onClick={() => onSelectDate(selected ? null : dateStr)}
            >
              {day}
              {hasDot && <span className="agenda-cal-dot" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function AgendaScreen({ user }) {
  const [activities, setActivities]       = useState([]);
  const [loading, setLoading]             = useState(true);
  const [modal, setModal]                 = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [toast, setToast]                 = useState('');
  const [selectedDate, setSelectedDate]   = useState(null);
  const toastTimer                        = useRef(null);

  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 4000);
  }

  useEffect(() => {
    const q = query(collection(db, 'agenda', user.uid, 'activities'), orderBy('date', 'asc'));
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
      headers: { ...(options.headers || {}), Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
  }

  async function handleSave({ title, date, time }) {
    try {
      if (modal.mode === 'add') {
        await authFetch(`${BACKEND}/api/agenda/${user.uid}`, { method: 'POST', body: JSON.stringify({ title, date, time }) });
        showToast(`'${title}' toegevoegd.`);
      } else {
        await authFetch(`${BACKEND}/api/agenda/${user.uid}/${modal.activity.id}`, { method: 'PUT', body: JSON.stringify({ title, date, time }) });
        showToast(`'${title}' bijgewerkt.`);
      }
      setModal(null);
    } catch { showToast('Er ging iets mis. Probeer het opnieuw.'); }
  }

  async function handleDelete(activity) {
    try {
      await authFetch(`${BACKEND}/api/agenda/${user.uid}/${activity.id}`, { method: 'DELETE' });
      setDeleteConfirm(null);
      showToast(`'${activity.title}' verwijderd.`);
    } catch { showToast('Er ging iets mis. Probeer het opnieuw.'); }
  }

  // Filter op geselecteerde datum of toon alles
  const visibleActivities = selectedDate
    ? activities.filter(a => a.date === selectedDate)
    : activities;

  const todayList    = visibleActivities.filter(a => isToday(a.date));
  const upcomingList = visibleActivities.filter(a => !isToday(a.date) && !isPast(a.date));
  const pastList     = visibleActivities.filter(a => isPast(a.date));

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
          onClick={() => setModal({ mode: 'add', prefillDate: selectedDate })}
          aria-label="Activiteit toevoegen"
        >
          + Toevoegen
        </button>
      </div>

      {/* Kalender */}
      {!loading && (
        <MiniCalendar
          activities={activities}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />
      )}

      {/* Geselecteerde datum label */}
      {selectedDate && (
        <div className="agenda-date-filter">
          <span>{formatDate(selectedDate)}</span>
          <button type="button" className="agenda-date-filter-clear" onClick={() => setSelectedDate(null)} aria-label="Filter wissen">✕</button>
        </div>
      )}

      {/* Lijst */}
      <div className="agenda-content">
        {loading && (
          <div className="agenda-empty">
            <p>Agenda laden…</p>
          </div>
        )}

        {!loading && visibleActivities.length === 0 && (
          <div className="agenda-empty">
            <p className="agenda-empty-title">
              {selectedDate ? 'Geen activiteiten op deze dag.' : 'Je hebt nog geen activiteiten.'}
            </p>
            {!selectedDate && <p className="agenda-empty-sub">Voeg je eerste toe!</p>}
            <button type="button" className="agenda-add-btn" onClick={() => setModal({ mode: 'add', prefillDate: selectedDate })}>
              + {selectedDate ? 'Toevoegen op deze dag' : 'Eerste activiteit toevoegen'}
            </button>
          </div>
        )}

        {!loading && todayList.length > 0 && (
          <div className="agenda-group">
            <div className="agenda-group-label agenda-group-label--today">Vandaag</div>
            {todayList.map(a => (
              <ActivityCard key={a.id} activity={a} highlight
                onEdit={() => setModal({ mode: 'edit', activity: a })}
                onDelete={() => setDeleteConfirm(a)} />
            ))}
          </div>
        )}

        {!loading && upcomingList.length > 0 && (
          <div className="agenda-group">
            {todayList.length > 0 && <div className="agenda-group-label">Aankomend</div>}
            {upcomingList.map(a => (
              <ActivityCard key={a.id} activity={a}
                onEdit={() => setModal({ mode: 'edit', activity: a })}
                onDelete={() => setDeleteConfirm(a)} />
            ))}
          </div>
        )}

        {!loading && pastList.length > 0 && (
          <div className="agenda-group">
            <div className="agenda-group-label agenda-group-label--past">Verlopen</div>
            {pastList.map(a => (
              <ActivityCard key={a.id} activity={a} past
                onEdit={() => setModal({ mode: 'edit', activity: a })}
                onDelete={() => setDeleteConfirm(a)} />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {modal && (
        <AgendaModal
          mode={modal.mode}
          initial={modal.activity || (modal.prefillDate ? { date: modal.prefillDate } : undefined)}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      {deleteConfirm && (
        <div className="agenda-dialog-backdrop" role="dialog" aria-modal="true" onClick={() => setDeleteConfirm(null)}>
          <div className="agenda-dialog" onClick={e => e.stopPropagation()}>
            <p className="agenda-dialog-text">Weet je zeker dat je <strong>'{deleteConfirm.title}'</strong> wilt verwijderen?</p>
            <div className="agenda-dialog-actions">
              <button type="button" className="agenda-btn-cancel" onClick={() => setDeleteConfirm(null)}>Annuleren</button>
              <button type="button" className="agenda-btn-danger" onClick={() => handleDelete(deleteConfirm)}>Verwijderen</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="agenda-toast" role="status" aria-live="polite">{toast}</div>}
    </div>
  );
}

function ActivityCard({ activity, highlight, past, onEdit, onDelete }) {
  return (
    <div className={`agenda-card${highlight ? ' agenda-card--today' : ''}${past ? ' agenda-card--past' : ''}`}>
      <div style={{ flex: 1 }}>
        <div className="agenda-card-date">{formatDate(activity.date)}</div>
        <div className="agenda-card-title">{activity.title}</div>
        {activity.time && <div className="agenda-card-time">{activity.time}</div>}
      </div>
      <div className="agenda-card-actions">
        <button type="button" className="agenda-icon-btn" aria-label={`Bewerk ${activity.title}`} onClick={onEdit}>
          <MagicEdit size={16} aria-hidden="true" />
        </button>
        <button type="button" className="agenda-icon-btn agenda-icon-btn--danger" aria-label={`Verwijder ${activity.title}`} onClick={onDelete}>
          <Delete size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
