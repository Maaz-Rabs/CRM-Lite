import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Building2, LogIn, Eye, EyeOff, Loader2, Sun, Moon,
  Users, TrendingUp, ShieldCheck, ChevronLeft, ChevronRight
} from 'lucide-react';
import { STORAGE_KEYS } from '../../utils/api';
import './Login.css';

// ─── Carousel slides ──────────────────────────────────────
const SLIDES = [
  {
    icon: Users,
    title: 'Manage Leads Effortlessly',
    desc: 'Centralize every lead, assign teams, and track conversions from one clean dashboard.',
  },
  {
    icon: TrendingUp,
    title: 'Real-time Insights',
    desc: 'Make faster decisions with live reports, follow-up tracking and team performance analytics.',
  },
  {
    icon: ShieldCheck,
    title: 'Secure & Role-based',
    desc: 'Granular permissions keep your data safe — Admin, Team Leader, Sales Manager, Tele Caller.',
  },
];

const Login = () => {
  const { login } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ─── Theme (light/dark) ────────────────────────────────
  const [theme, setTheme] = useState(() => localStorage.getItem('login_theme') || 'dark');
  useEffect(() => {
    localStorage.setItem('login_theme', theme);
  }, [theme]);
  const toggleTheme = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'));

  // ─── Carousel auto-rotate ──────────────────────────────
  const [slideIdx, setSlideIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSlideIdx(i => (i + 1) % SLIDES.length), 4500);
    return () => clearInterval(id);
  }, []);
  const nextSlide = () => setSlideIdx(i => (i + 1) % SLIDES.length);
  const prevSlide = () => setSlideIdx(i => (i - 1 + SLIDES.length) % SLIDES.length);

  // ─── Seed default client data (temporary, client-code page commented) ─────
  useEffect(() => {
    const existing = localStorage.getItem(STORAGE_KEYS.CLIENT_DATA);
    if (!existing) {
      const defaultClient = {
        clientCode: 'default',
        companyName: 'RABS Connect',
        apiBaseUrl: 'http://localhost:5000/api',
      };
      localStorage.setItem(STORAGE_KEYS.CLIENT_DATA, JSON.stringify(defaultClient));
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username.trim()) { setError('Please enter username'); return; }
    if (!password) { setError('Please enter password'); return; }
    setLoading(true);
    setError('');
    const result = await login(username, password);
    setLoading(false);
    if (!result.success) {
      setError(result.message);
    }
  };

  const ActiveIcon = SLIDES[slideIdx].icon;

  return (
    <div className={`login-page login-page--${theme}`}>
      {/* Theme toggle */}
      <button
        type="button"
        className="login-theme-toggle"
        onClick={toggleTheme}
        aria-label="Toggle theme"
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <div className="login-shell">
        {/* ───── Left: Carousel / Info panel ───── */}
        <div className="login-info">
          {/* Decorative glow blobs */}
          <div className="login-info__blob-a" />
          <div className="login-info__blob-b" />

          <div className="login-info__brand">
            <div className="login-logo">
              <Building2 size={28} />
            </div>
            <span className="login-info__brand-name">RABS Connect</span>
          </div>

          <div className="login-info__slider">
            <div className="login-info__slide" key={slideIdx}>
              <div className="login-info__slide-icon">
                <ActiveIcon size={32} />
              </div>
              <h2 className="login-info__slide-title">{SLIDES[slideIdx].title}</h2>
              <p className="login-info__slide-desc">{SLIDES[slideIdx].desc}</p>
            </div>

            <div className="login-info__controls">
              <button type="button" className="login-info__arrow" onClick={prevSlide} aria-label="Previous">
                <ChevronLeft size={18} />
              </button>
              <div className="login-info__dots">
                {SLIDES.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`login-info__dot ${i === slideIdx ? 'is-active' : ''}`}
                    onClick={() => setSlideIdx(i)}
                    aria-label={`Slide ${i + 1}`}
                  />
                ))}
              </div>
              <button type="button" className="login-info__arrow" onClick={nextSlide} aria-label="Next">
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          <div className="login-info__footer">
            © {new Date().getFullYear()} RABS Net Solutions
          </div>
        </div>

        {/* ───── Right: Sign-in form ───── */}
        <div className="login-card">
          <div className="login-header">
            <div className="login-logo login-logo--mobile">
              <Building2 size={28} />
            </div>
            <h1 className="login-title">Welcome back</h1>
            <p className="login-subtitle">Sign in to your account</p>
          </div>

          {error && <div className="login-error">{error}</div>}

          {/* ───── Client-code form (commented) ─────
          {step === 'client' ? (
            <form onSubmit={handleVerifyClient} className="login-form">
              <div className="login-field">
                <label className="login-label">Client Code</label>
                <input
                  className="login-input"
                  type="text"
                  placeholder="Enter client code"
                  value={clientCode}
                  onChange={e => setClientCode(e.target.value)}
                  autoFocus
                />
              </div>
              <button className="login-btn" type="submit" disabled={loading}>
                {loading ? <Loader2 size={18} className="spin" /> : <ArrowRight size={18} />}
                <span>{loading ? 'Verifying...' : 'Continue'}</span>
              </button>
            </form>
          ) : (
          ─────────────────────────────────────── */}

          <form onSubmit={handleLogin} className="login-form">
            <div className="login-field">
              <label className="login-label">Username</label>
              <input
                className="login-input"
                type="text"
                placeholder="Enter username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoFocus
              />
            </div>
            <div className="login-field">
              <label className="login-label">Password</label>
              <div className="login-password-wrap">
                <input
                  className="login-input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="login-eye"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button className="login-btn" type="submit" disabled={loading}>
              {loading ? <Loader2 size={18} className="spin" /> : <LogIn size={18} />}
              <span>{loading ? 'Signing in...' : 'Sign In'}</span>
            </button>

            {/* ───── Change client code link (commented) ─────
            <button
              type="button"
              className="login-link"
              onClick={() => { setStep('client'); setError(''); }}
            >
              Change client code
            </button>
            ─────────────────────────────────────── */}
          </form>

          {/* ───── end of client/login step ternary (commented) ───── */}
          {/* )} */}
        </div>
      </div>
    </div>
  );
};

export default Login;
