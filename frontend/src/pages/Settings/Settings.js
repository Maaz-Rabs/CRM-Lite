import React, { useEffect, useMemo, useState } from 'react';
import Header from '../../components/layout/Header';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { apiFetch, STORAGE_KEYS } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { Button, Modal } from '../../components/common/Common';
import {
  Moon, Clock, DollarSign, Bell, Volume2, Vibrate,
  Plus, Trash2, Loader2, AlertCircle, MessageCircle, Database,
  AlertTriangle, ChevronRight, Save
} from 'lucide-react';
import './Settings.css';

const LOCAL_KEYS = {
  timezone: 'rabs_pref_timezone',
  currency: 'rabs_pref_currency',
  pushEnabled: 'rabs_pref_push',
  soundEnabled: 'rabs_pref_sound',
  vibrationEnabled: 'rabs_pref_vibration',
  whatsappMsg: 'rabs_pref_whatsapp_msg',
};

const DEFAULT_WA_MSG = 'Hi {name}, this is regarding your enquiry. Let us know a good time to connect.';

// localStorage keys to keep when clearing cache (so user stays logged in & client config persists)
const PRESERVE_KEYS = [
  STORAGE_KEYS.CLIENT_DATA,
  STORAGE_KEYS.USER_DATA,
  STORAGE_KEYS.TOKENS,
  STORAGE_KEYS.PERMISSIONS,
  STORAGE_KEYS.CRM_SETTINGS,
  'app_theme',
];

const TIMEZONES = [
  'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Asia/Tokyo',
  'Europe/London', 'Europe/Paris', 'America/New_York', 'America/Los_Angeles',
  'Australia/Sydney', 'UTC'
];

const CURRENCIES = [
  { code: 'INR', label: '₹ Indian Rupee' },
  { code: 'USD', label: '$ US Dollar' },
  { code: 'EUR', label: '€ Euro' },
  { code: 'GBP', label: '£ British Pound' },
  { code: 'AED', label: 'د.إ UAE Dirham' },
  { code: 'SGD', label: 'S$ Singapore Dollar' },
];

const loadLocal = (key, fallback) => {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return fallback;
    if (v === 'true') return true;
    if (v === 'false') return false;
    return v;
  } catch { return fallback; }
};

const saveLocal = (key, val) => {
  try { localStorage.setItem(key, String(val)); } catch { }
};

const Settings = () => {
  const { theme, toggleTheme } = useTheme();
  const { isAdmin, user, logout } = useAuth();
  const { showToast } = useToast();

  // WhatsApp default message
  const [waMsg, setWaMsg] = useState(() => {
    try { return localStorage.getItem(LOCAL_KEYS.whatsappMsg) || ''; } catch { return ''; }
  });
  const [waModalOpen, setWaModalOpen] = useState(false);
  const [waDraft, setWaDraft] = useState('');

  // Delete Account
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Local preferences
  const [timezone, setTimezone] = useState(() => loadLocal(LOCAL_KEYS.timezone, 'Asia/Kolkata'));
  const [currency, setCurrency] = useState(() => loadLocal(LOCAL_KEYS.currency, 'INR'));
  const [pushEnabled, setPushEnabled] = useState(() => loadLocal(LOCAL_KEYS.pushEnabled, true));
  const [soundEnabled, setSoundEnabled] = useState(() => loadLocal(LOCAL_KEYS.soundEnabled, true));
  const [vibrationEnabled, setVibrationEnabled] = useState(() => loadLocal(LOCAL_KEYS.vibrationEnabled, true));

  // Follow-up reminders (backed by /api/reminder-settings)
  const [reminders, setReminders] = useState([]);
  const [remLoading, setRemLoading] = useState(true);
  const [remSaving, setRemSaving] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newOffset, setNewOffset] = useState('');

  const loadReminders = async () => {
    setRemLoading(true);
    try {
      const res = await apiFetch('reminder-settings');
      if (res.success) setReminders(res.data || []);
    } catch { }
    setRemLoading(false);
  };

  useEffect(() => { loadReminders(); }, []);

  // persist simple local prefs on change
  useEffect(() => { saveLocal(LOCAL_KEYS.timezone, timezone); }, [timezone]);
  useEffect(() => { saveLocal(LOCAL_KEYS.currency, currency); }, [currency]);
  useEffect(() => { saveLocal(LOCAL_KEYS.soundEnabled, soundEnabled); }, [soundEnabled]);
  useEffect(() => { saveLocal(LOCAL_KEYS.vibrationEnabled, vibrationEnabled); }, [vibrationEnabled]);

  const handleTogglePush = async () => {
    const next = !pushEnabled;
    if (next && 'Notification' in window) {
      if (Notification.permission === 'default') {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') {
          showToast('Browser notification permission denied', 'error');
          return;
        }
      } else if (Notification.permission === 'denied') {
        showToast('Notifications are blocked in your browser settings', 'error');
        return;
      }
    }
    setPushEnabled(next);
    saveLocal(LOCAL_KEYS.pushEnabled, next);
    showToast(next ? 'Push notifications enabled' : 'Push notifications disabled', 'success');
  };

  const handleToggleReminder = async (frs_id) => {
    setRemSaving(true);
    setReminders(prev => prev.map(r => r.frs_id === frs_id ? { ...r, is_active: r.is_active ? 0 : 1 } : r));
    try {
      const res = await apiFetch(`reminder-settings/${frs_id}/toggle`, { method: 'PATCH' });
      if (!res.success) {
        showToast(res.message || 'Failed to toggle reminder', 'error');
        loadReminders();
      }
    } catch {
      showToast('Connection failed', 'error');
      loadReminders();
    }
    setRemSaving(false);
  };

  const handleDeleteReminder = async (frs_id) => {
    if (!window.confirm('Delete this reminder preset?')) return;
    setRemSaving(true);
    try {
      const res = await apiFetch(`reminder-settings/${frs_id}`, { method: 'DELETE' });
      if (res.success) {
        setReminders(prev => prev.filter(r => r.frs_id !== frs_id));
        showToast('Reminder deleted', 'success');
      } else {
        showToast(res.message || 'Failed to delete', 'error');
      }
    } catch {
      showToast('Connection failed', 'error');
    }
    setRemSaving(false);
  };

  const handleAddReminder = async (e) => {
    e.preventDefault();
    const offset = parseInt(newOffset, 10);
    if (!newLabel.trim() || Number.isNaN(offset)) {
      showToast('Enter a label and minutes offset', 'error');
      return;
    }
    setRemSaving(true);
    try {
      const res = await apiFetch('reminder-settings', {
        method: 'POST',
        body: JSON.stringify({ label: newLabel.trim(), minutes_offset: offset }),
      });
      if (res.success) {
        showToast('Reminder added', 'success');
        setNewLabel('');
        setNewOffset('');
        loadReminders();
      } else {
        showToast(res.message || 'Failed to add reminder', 'error');
      }
    } catch {
      showToast('Connection failed', 'error');
    }
    setRemSaving(false);
  };

  const sortedReminders = useMemo(
    () => [...reminders].sort((a, b) => (a.minutes_offset || 0) - (b.minutes_offset || 0)),
    [reminders]
  );

  // ─── WhatsApp message handlers ─────────────────────────────
  const openWaModal = () => {
    setWaDraft(waMsg || DEFAULT_WA_MSG);
    setWaModalOpen(true);
  };

  const saveWaMsg = () => {
    const trimmed = waDraft.trim();
    try {
      if (trimmed) localStorage.setItem(LOCAL_KEYS.whatsappMsg, trimmed);
      else localStorage.removeItem(LOCAL_KEYS.whatsappMsg);
    } catch { }
    setWaMsg(trimmed);
    setWaModalOpen(false);
    showToast('WhatsApp message template saved', 'success');
  };

  const resetWaMsg = () => {
    setWaDraft(DEFAULT_WA_MSG);
  };

  // ─── Clear cache handler ──────────────────────────────────
  const handleClearCache = () => {
    if (!window.confirm('Clear cached data? Your login and theme will be kept.')) return;
    try {
      const preserved = {};
      PRESERVE_KEYS.forEach(k => {
        const v = localStorage.getItem(k);
        if (v !== null) preserved[k] = v;
      });
      localStorage.clear();
      Object.entries(preserved).forEach(([k, v]) => localStorage.setItem(k, v));
      // also wipe sessionStorage
      try { sessionStorage.clear(); } catch { }
      showToast('Cache cleared successfully', 'success');
    } catch {
      showToast('Failed to clear cache', 'error');
    }
  };

  // ─── Delete account handler ───────────────────────────────
  const openDeleteModal = () => {
    setDeleteConfirmText('');
    setDeleteModalOpen(true);
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      showToast('Type DELETE to confirm', 'error');
      return;
    }
    const uid = user?.id || user?.u_id;
    if (!uid) {
      showToast('Could not determine your user id', 'error');
      return;
    }
    setDeleting(true);
    try {
      const res = await apiFetch(`users/${uid}`, {
        method: 'DELETE',
        body: JSON.stringify({ unassign: true }),
      });
      if (res.success) {
        showToast('Account deleted', 'success');
        setDeleteModalOpen(false);
        setTimeout(() => { logout(); }, 800);
      } else {
        showToast(res.message || 'Failed to delete account', 'error');
      }
    } catch {
      showToast('Connection failed', 'error');
    }
    setDeleting(false);
  };

  const Toggle = ({ checked, onChange, disabled }) => (
    <button
      type="button"
      className={`settings-toggle ${checked ? 'settings-toggle--on' : ''}`}
      onClick={disabled ? undefined : onChange}
      disabled={disabled}
      aria-pressed={checked}
    >
      <span className="settings-toggle__thumb" />
    </button>
  );

  return (
    <div>
      <Header title="Settings" subtitle="Appearance, language, notifications & reminders" />
      <div className="page">
        <div className="settings-layout">

          {/* Appearance */}
          <section className="settings-card">
            <h3 className="settings-section-title">Appearance</h3>
            <div className="settings-row">
              <div className="settings-row__icon settings-row__icon--theme"><Moon size={16} /></div>
              <div className="settings-row__main">
                <span className="settings-row__title">Dark Mode</span>
                <span className="settings-row__sub">{theme === 'dark' ? 'Dark theme enabled' : 'Light theme enabled'}</span>
              </div>
              <Toggle checked={theme === 'dark'} onChange={toggleTheme} />
            </div>
          </section>

          {/* Language & Region */}
          <section className="settings-card">
            <h3 className="settings-section-title">Language &amp; Region</h3>

            <div className="settings-row">
              <div className="settings-row__icon settings-row__icon--time"><Clock size={16} /></div>
              <div className="settings-row__main">
                <span className="settings-row__title">Timezone</span>
                <span className="settings-row__sub">{timezone}</span>
              </div>
              <select
                className="settings-select"
                value={timezone}
                onChange={e => setTimezone(e.target.value)}
              >
                {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>

            <div className="settings-row">
              <div className="settings-row__icon settings-row__icon--currency"><DollarSign size={16} /></div>
              <div className="settings-row__main">
                <span className="settings-row__title">Currency</span>
                <span className="settings-row__sub">
                  {CURRENCIES.find(c => c.code === currency)?.label || currency}
                </span>
              </div>
              <select
                className="settings-select"
                value={currency}
                onChange={e => setCurrency(e.target.value)}
              >
                {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
            </div>
          </section>

          {/* Notifications */}
          <section className="settings-card">
            <h3 className="settings-section-title">Notifications</h3>

            <div className="settings-row">
              <div className="settings-row__icon settings-row__icon--bell"><Bell size={16} /></div>
              <div className="settings-row__main">
                <span className="settings-row__title">Push Notifications</span>
                <span className="settings-row__sub">Receive push notifications</span>
              </div>
              <Toggle checked={pushEnabled} onChange={handleTogglePush} />
            </div>

            <div className="settings-row">
              <div className="settings-row__icon settings-row__icon--sound"><Volume2 size={16} /></div>
              <div className="settings-row__main">
                <span className="settings-row__title">Sound</span>
                <span className="settings-row__sub">Play notification sound</span>
              </div>
              <Toggle checked={soundEnabled} onChange={() => setSoundEnabled(v => !v)} />
            </div>

            <div className="settings-row">
              <div className="settings-row__icon settings-row__icon--vibe"><Vibrate size={16} /></div>
              <div className="settings-row__main">
                <span className="settings-row__title">Vibration</span>
                <span className="settings-row__sub">Vibrate on notifications (mobile devices)</span>
              </div>
              <Toggle checked={vibrationEnabled} onChange={() => setVibrationEnabled(v => !v)} />
            </div>
          </section>

          {/* Follow-up Reminders */}
          <section className="settings-card">
            <h3 className="settings-section-title">Follow-up Reminders</h3>
            <p className="settings-section-hint">
              Configure when follow-up reminders are sent. Negative offsets are before the scheduled time; positive offsets are after.
            </p>

            {remLoading ? (
              <div className="settings-loading"><Loader2 size={16} className="spin" /> Loading reminders…</div>
            ) : sortedReminders.length === 0 ? (
              <div className="settings-empty">
                <AlertCircle size={16} />
                <span>No reminder presets configured yet.</span>
              </div>
            ) : (
              <div className="settings-reminders">
                {sortedReminders.map(r => (
                  <div key={r.frs_id} className="settings-row">
                    <div className={`settings-row__icon ${r.minutes_offset < 0 ? 'settings-row__icon--time' : r.minutes_offset === 0 ? 'settings-row__icon--bell' : 'settings-row__icon--vibe'}`}>
                      <Clock size={16} />
                    </div>
                    <div className="settings-row__main">
                      <span className="settings-row__title">{r.label}</span>
                      <span className="settings-row__sub">
                        {r.minutes_offset === 0
                          ? 'At scheduled time'
                          : r.minutes_offset < 0
                            ? `${Math.abs(r.minutes_offset)} minutes before`
                            : `${r.minutes_offset} minutes after`}
                      </span>
                    </div>
                    <Toggle
                      checked={!!r.is_active}
                      onChange={() => handleToggleReminder(r.frs_id)}
                      disabled={remSaving}
                    />
                    {isAdmin && (
                      <button
                        type="button"
                        className="settings-row__delete"
                        onClick={() => handleDeleteReminder(r.frs_id)}
                        disabled={remSaving}
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {isAdmin && (
              <form className="settings-add-reminder" onSubmit={handleAddReminder}>
                <input
                  type="text"
                  className="settings-input"
                  placeholder="Label (e.g. 15 minutes before)"
                  value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                />
                <input
                  type="number"
                  className="settings-input settings-input--sm"
                  placeholder="Minutes offset"
                  value={newOffset}
                  onChange={e => setNewOffset(e.target.value)}
                  title="Negative = before, 0 = on time, positive = after"
                />
                <Button variant="gold" type="submit" disabled={remSaving}>
                  <Plus size={14} /> Add
                </Button>
              </form>
            )}
          </section>

          {/* WhatsApp */}
          <section className="settings-card">
            <h3 className="settings-section-title">WhatsApp</h3>
            <button type="button" className="settings-row settings-row--clickable" onClick={openWaModal}>
              <div className="settings-row__icon settings-row__icon--whatsapp"><MessageCircle size={16} /></div>
              <div className="settings-row__main">
                <span className="settings-row__title">Default WhatsApp Message</span>
                <span className="settings-row__sub">
                  {waMsg ? waMsg : 'Tap to set a message template'}
                </span>
              </div>
              <ChevronRight size={16} className="settings-row__chevron" />
            </button>
          </section>

          {/* Data & Storage */}
          <section className="settings-card">
            <h3 className="settings-section-title">Data &amp; Storage</h3>
            <button type="button" className="settings-row settings-row--clickable" onClick={handleClearCache}>
              <div className="settings-row__icon settings-row__icon--cache"><Database size={16} /></div>
              <div className="settings-row__main">
                <span className="settings-row__title">Clear Cache</span>
                <span className="settings-row__sub">Free up storage space (login is preserved)</span>
              </div>
              <ChevronRight size={16} className="settings-row__chevron" />
            </button>
          </section>

          {/* Danger Zone */}
          <section className="settings-card settings-card--danger">
            <h3 className="settings-section-title settings-section-title--danger">Danger Zone</h3>
            <button type="button" className="settings-row settings-row--clickable settings-row--danger" onClick={openDeleteModal}>
              <div className="settings-row__icon settings-row__icon--danger"><Trash2 size={16} /></div>
              <div className="settings-row__main">
                <span className="settings-row__title settings-row__title--danger">Delete Account</span>
                <span className="settings-row__sub">Permanently delete your account</span>
              </div>
              <ChevronRight size={16} className="settings-row__chevron" />
            </button>
          </section>

        </div>
      </div>

      {/* WhatsApp Message Modal */}
      <Modal isOpen={waModalOpen} onClose={() => setWaModalOpen(false)} title="Default WhatsApp Message" size="md">
        <div className="settings-modal">
          <p className="settings-modal__hint">
            This template will be used when sending WhatsApp messages from leads. You can use placeholders like <code>{'{name}'}</code> for personalization.
          </p>
          <textarea
            className="settings-textarea"
            rows={6}
            value={waDraft}
            onChange={e => setWaDraft(e.target.value)}
            placeholder={DEFAULT_WA_MSG}
            maxLength={1000}
          />
          <div className="settings-modal__meta">
            <span>{waDraft.length} / 1000</span>
            <button type="button" className="settings-link-btn" onClick={resetWaMsg}>
              Reset to default
            </button>
          </div>
          <div className="settings-modal__actions">
            <Button variant="outline" onClick={() => setWaModalOpen(false)}>Cancel</Button>
            <Button variant="gold" onClick={saveWaMsg}>
              <Save size={14} /> Save Template
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Account Modal */}
      <Modal isOpen={deleteModalOpen} onClose={() => !deleting && setDeleteModalOpen(false)} title="Delete Account" size="md">
        <div className="settings-modal">
          <div className="settings-danger-banner">
            <AlertTriangle size={18} />
            <div>
              <strong>This action cannot be undone.</strong>
              <p>Your account will be permanently deleted. Any leads currently assigned to you will be unassigned. You will be signed out immediately.</p>
            </div>
          </div>

          <div className="settings-field">
            <label>Type <strong>DELETE</strong> to confirm</label>
            <input
              type="text"
              className="settings-input settings-input--full"
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              disabled={deleting}
              autoFocus
            />
          </div>

          <div className="settings-modal__actions">
            <Button variant="outline" onClick={() => setDeleteModalOpen(false)} disabled={deleting}>Cancel</Button>
            <Button
              variant="danger"
              onClick={handleDeleteAccount}
              disabled={deleting || deleteConfirmText !== 'DELETE'}
            >
              {deleting ? <><Loader2 size={14} className="spin" /> Deleting...</> : <><Trash2 size={14} /> Delete My Account</>}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Settings;
