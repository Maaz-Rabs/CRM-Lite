import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../utils/api';
import Header from '../../components/layout/Header';
import { Button } from '../../components/common/Common';
import { Lock, Eye, EyeOff, ShieldCheck, AlertCircle, CheckCircle2, KeyRound } from 'lucide-react';
import './ChangePassword.css';

const strengthScore = (pw) => {
  let s = 0;
  if (!pw) return 0;
  if (pw.length >= 6) s++;
  if (pw.length >= 10) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^\w\s]/.test(pw)) s++;
  return Math.min(s, 4);
};
const strengthLabel = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'];
const strengthColor = ['#ef4444', '#f59e0b', '#eab308', '#22c55e', '#10b981'];

const ChangePassword = () => {
  const { logout, user } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const score = strengthScore(next);
  const match = next && confirm && next === confirm;
  const mismatch = confirm && !match;
  const canSubmit = current && next.length >= 6 && match && !saving;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setFeedback(null);
    setSaving(true);
    try {
      const res = await apiFetch('auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ current_password: current, new_password: next }),
      });
      if (res.success) {
        setFeedback({ type: 'success', msg: 'Password changed. You will be signed out for security.' });
        setCurrent(''); setNext(''); setConfirm('');
        setTimeout(() => { logout(); }, 1600);
      } else {
        setFeedback({ type: 'error', msg: res.message || 'Could not change password' });
      }
    } catch {
      setFeedback({ type: 'error', msg: 'Connection failed' });
    }
    setSaving(false);
  };

  return (
    <div>
      <Header title="Change Password" subtitle="Update your account password" />
      <div className="page">
        <div className="cp-layout">
          <form className="cp-card" onSubmit={handleSubmit}>
            <div className="cp-card__head">
              <div className="cp-card__icon"><KeyRound size={22} /></div>
              <div>
                <h3 className="cp-card__title">Update Password</h3>
                <p className="cp-card__sub">Signed in as <strong>{user?.username || 'you'}</strong></p>
              </div>
            </div>

            <div className="cp-field">
              <label>Current Password</label>
              <div className="cp-input">
                <Lock size={15} />
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  placeholder="Enter your current password"
                  autoComplete="current-password"
                  required
                />
                <button type="button" className="cp-input__toggle" onClick={() => setShowCurrent(v => !v)} tabIndex={-1}>
                  {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div className="cp-field">
              <label>New Password</label>
              <div className="cp-input">
                <Lock size={15} />
                <input
                  type={showNext ? 'text' : 'password'}
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  placeholder="At least 6 characters"
                  autoComplete="new-password"
                  required
                  minLength={6}
                />
                <button type="button" className="cp-input__toggle" onClick={() => setShowNext(v => !v)} tabIndex={-1}>
                  {showNext ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {next && (
                <div className="cp-strength">
                  <div className="cp-strength__bars">
                    {[0, 1, 2, 3].map(i => (
                      <span
                        key={i}
                        className="cp-strength__bar"
                        style={{ background: i < score ? strengthColor[score] : 'var(--gray-200)' }}
                      />
                    ))}
                  </div>
                  <span className="cp-strength__label" style={{ color: strengthColor[score] }}>
                    {strengthLabel[score]}
                  </span>
                </div>
              )}
            </div>

            <div className="cp-field">
              <label>Confirm New Password</label>
              <div className={`cp-input ${mismatch ? 'cp-input--error' : ''}`}>
                <Lock size={15} />
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Re-enter new password"
                  autoComplete="new-password"
                  required
                />
                <button type="button" className="cp-input__toggle" onClick={() => setShowConfirm(v => !v)} tabIndex={-1}>
                  {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {mismatch && <span className="cp-hint cp-hint--error"><AlertCircle size={12} /> Passwords don't match</span>}
              {match && <span className="cp-hint cp-hint--ok"><CheckCircle2 size={12} /> Passwords match</span>}
            </div>

            {feedback && (
              <div className={`cp-alert cp-alert--${feedback.type}`}>
                {feedback.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                <span>{feedback.msg}</span>
              </div>
            )}

            <div className="cp-actions">
              <Button variant="gold" type="submit" disabled={!canSubmit}>
                {saving ? 'Updating...' : 'Update Password'}
              </Button>
            </div>
          </form>

          {/* Side tips */}
          <aside className="cp-side">
            <div className="cp-tip-card">
              <div className="cp-tip-card__icon"><ShieldCheck size={18} /></div>
              <h4>Keep your account safe</h4>
              <ul className="cp-tips">
                <li>Use at least <strong>8 characters</strong>, including numbers and symbols.</li>
                <li>Avoid reusing passwords from other sites.</li>
                <li>Never share your password with anyone.</li>
                <li>You'll be signed out of all devices after changing.</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default ChangePassword;
