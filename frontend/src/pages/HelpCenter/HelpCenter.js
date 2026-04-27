import React, { useEffect, useMemo, useState } from 'react';
import Header from '../../components/layout/Header';
import { Button, Modal } from '../../components/common/Common';
import { useToast } from '../../context/ToastContext';
import { apiFetch, getFileUrl } from '../../utils/api';
import {
  LifeBuoy, Send, Loader2, AlertCircle,
  Image as ImageIcon, X, Inbox, CheckCircle2, Clock,
  Mail, Eye, RefreshCw, Search
} from 'lucide-react';
import './HelpCenter.css';

const CATEGORIES = [
  { value: 'bug', label: 'Bug / Issue' },
  { value: 'feature', label: 'Feature Request' },
  { value: 'account', label: 'Account / Login' },
  { value: 'billing', label: 'Billing' },
  { value: 'other', label: 'Other' },
];

const STATUS_META = {
  open: { label: 'Open', icon: Inbox, color: 'info' },
  in_progress: { label: 'In Progress', icon: Clock, color: 'warning' },
  resolved: { label: 'Resolved', icon: CheckCircle2, color: 'success' },
  closed: { label: 'Closed', icon: CheckCircle2, color: 'muted' },
};

const HelpCenter = () => {
  const { showToast } = useToast();

  const [tickets, setTickets] = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);

  // Submit form modal
  const [submitOpen, setSubmitOpen] = useState(false);
  const [category, setCategory] = useState('bug');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // View ticket modal
  const [viewTicket, setViewTicket] = useState(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadTickets = async () => {
    setTicketsLoading(true);
    try {
      const res = await apiFetch('support-tickets');
      if (res.success) setTickets(res.data?.tickets || res.tickets || []);
    } catch {
      showToast('Failed to load tickets', 'error');
    }
    setTicketsLoading(false);
  };

  useEffect(() => { loadTickets(); }, []);

  const resetSubmitForm = () => {
    setCategory('bug');
    setSubject('');
    setDescription('');
    setImageFile(null);
    setImagePreview('');
  };

  const openSubmit = () => {
    resetSubmitForm();
    setSubmitOpen(true);
  };

  const closeSubmit = () => {
    if (submitting) return;
    setSubmitOpen(false);
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image must be under 5MB', 'error');
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) {
      showToast('Subject and description are required', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('category', category);
      fd.append('subject', subject.trim());
      fd.append('description', description.trim());
      if (imageFile) fd.append('image', imageFile);

      const res = await apiFetch('support-tickets', {
        method: 'POST',
        body: fd,
      });
      if (res.success) {
        showToast('Ticket submitted successfully', 'success');
        resetSubmitForm();
        setSubmitOpen(false);
        loadTickets();
      } else {
        showToast(res.message || 'Failed to submit ticket', 'error');
      }
    } catch {
      showToast('Connection failed', 'error');
    }
    setSubmitting(false);
  };

  const formatDate = (d) => {
    if (!d) return '';
    try {
      return new Date(d).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true,
      });
    } catch { return d; }
  };

  const formatDateShort = (d) => {
    if (!d) return '';
    try {
      return new Date(d).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
      });
    } catch { return d; }
  };

  const categoryLabel = (val) =>
    CATEGORIES.find(c => c.value === val)?.label || val || 'Other';

  // ─── Stats + filtered list (derived from tickets) ───────────
  const stats = useMemo(() => ({
    total: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    in_progress: tickets.filter(t => t.status === 'in_progress').length,
    resolved: tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length,
  }), [tickets]);

  const filteredTickets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return tickets.filter(t => {
      if (statusFilter !== 'all') {
        if (statusFilter === 'resolved') {
          if (t.status !== 'resolved' && t.status !== 'closed') return false;
        } else if (t.status !== statusFilter) {
          return false;
        }
      }
      if (q) {
        const hay = `${t.subject || ''} ${t.description || ''} #${t.st_id}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [tickets, searchQuery, statusFilter]);

  return (
    <div>
      <Header title="Help Center" subtitle="Contact support and track your tickets" />
      <div className="page">
        <div className="hc-layout">

          {/* Hero with CTA */}
          <section className="hc-hero">
            <div className="hc-hero__icon">
              <LifeBuoy size={28} />
            </div>
            <div className="hc-hero__content">
              <h2 className="hc-hero__title">How can we help you today?</h2>
              <p className="hc-hero__sub">Raise a support ticket and our team will get back to you. Track all your requests below.</p>
              <a href="mailto:support@rabs.asia" className="hc-hero__chip" title="Email support">
                <Mail size={14} /> support@rabs.asia
              </a>
            </div>
            <div className="hc-hero__cta">
              <Button variant="gold" onClick={openSubmit}>
                <Send size={14} /> Submit Ticket
              </Button>
            </div>
          </section>

          {/* Stats */}
          <div className="hc-totals">
            <button
              type="button"
              className={`hc-total-card ${statusFilter === 'all' ? 'hc-total-card--active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              <div className="hc-total-card__head">
                <span className="hc-total-card__icon hc-total-card__icon--total"><Inbox size={15} /></span>
                <span className="hc-total-label">Total Tickets</span>
              </div>
              <span className="hc-total-value">{stats.total}</span>
            </button>
            <button
              type="button"
              className={`hc-total-card ${statusFilter === 'open' ? 'hc-total-card--active' : ''}`}
              onClick={() => setStatusFilter('open')}
            >
              <div className="hc-total-card__head">
                <span className="hc-total-card__icon hc-total-card__icon--open"><AlertCircle size={15} /></span>
                <span className="hc-total-label">Open</span>
              </div>
              <span className="hc-total-value">{stats.open}</span>
            </button>
            <button
              type="button"
              className={`hc-total-card ${statusFilter === 'in_progress' ? 'hc-total-card--active' : ''}`}
              onClick={() => setStatusFilter('in_progress')}
            >
              <div className="hc-total-card__head">
                <span className="hc-total-card__icon hc-total-card__icon--progress"><Clock size={15} /></span>
                <span className="hc-total-label">In Progress</span>
              </div>
              <span className="hc-total-value">{stats.in_progress}</span>
            </button>
            <button
              type="button"
              className={`hc-total-card ${statusFilter === 'resolved' ? 'hc-total-card--active' : ''}`}
              onClick={() => setStatusFilter('resolved')}
            >
              <div className="hc-total-card__head">
                <span className="hc-total-card__icon hc-total-card__icon--resolved"><CheckCircle2 size={15} /></span>
                <span className="hc-total-label">Resolved</span>
              </div>
              <span className="hc-total-value">{stats.resolved}</span>
            </button>
          </div>

          {/* My Tickets — always visible */}
          <section className="hc-card">
            <div className="hc-card__head">
              <Inbox size={16} className="hc-card__head-icon" />
              <h3 className="hc-card__title">My Tickets</h3>
              <button
                type="button"
                className="hc-card__head-action"
                onClick={loadTickets}
                disabled={ticketsLoading}
                title="Refresh"
              >
                <RefreshCw size={13} className={ticketsLoading ? 'spin' : ''} />
                Refresh
              </button>
            </div>

            {/* Filter bar */}
            <div className="hc-filterbar">
              <div className="hc-search">
                <Search size={14} />
                <input
                  type="text"
                  placeholder="Search by subject, description or ID…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button type="button" className="hc-search__clear" onClick={() => setSearchQuery('')} title="Clear">
                    <X size={13} />
                  </button>
                )}
              </div>
              <div className="hc-filter-group">
                <label htmlFor="hc-status">Status:</label>
                <select
                  id="hc-status"
                  className="hc-select"
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                >
                  <option value="all">All Statuses</option>
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved / Closed</option>
                </select>
              </div>
            </div>

            {ticketsLoading ? (
              <div className="hc-state">
                <Loader2 size={18} className="spin" />
                <span>Loading tickets…</span>
              </div>
            ) : tickets.length === 0 ? (
              <div className="hc-state hc-state--empty">
                <AlertCircle size={20} />
                <span>You haven't submitted any tickets yet.</span>
                <Button variant="gold" size="sm" onClick={openSubmit}>
                  <Send size={13} /> Submit Your First Ticket
                </Button>
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="hc-state hc-state--empty">
                <AlertCircle size={20} />
                <span>No tickets match your filters.</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setSearchQuery(''); setStatusFilter('all'); }}
                >
                  Clear filters
                </Button>
              </div>
            ) : (
              <div className="hc-table-wrap">
                <table className="hc-table">
                  <thead>
                    <tr>
                      <th className="hc-th-id">ID</th>
                      <th>Subject</th>
                      <th>Category</th>
                      <th>Status</th>
                      <th>Created</th>
                      <th className="hc-th-action">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTickets.map(t => {
                      const meta = STATUS_META[t.status] || STATUS_META.open;
                      const StatusIcon = meta.icon;
                      return (
                        <tr key={t.st_id} className="hc-tr">
                          <td className="hc-td-id">#{t.st_id}</td>
                          <td className="hc-td-subject">
                            <span className="hc-td-subject__text">{t.subject}</span>
                          </td>
                          <td>
                            <span className={`hc-cat-tag hc-cat-tag--${t.category || 'other'}`}>
                              {categoryLabel(t.category)}
                            </span>
                          </td>
                          <td>
                            <span className={`hc-status hc-status--${meta.color}`}>
                              <StatusIcon size={12} />
                              {meta.label}
                            </span>
                          </td>
                          <td className="hc-td-date">{formatDateShort(t.created_at)}</td>
                          <td className="hc-td-action">
                            <button
                              type="button"
                              className="hc-action-btn"
                              onClick={() => setViewTicket(t)}
                              title="View details"
                            >
                              <Eye size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

        </div>
      </div>

      {/* Submit Ticket Modal */}
      <Modal isOpen={submitOpen} onClose={closeSubmit} title="Submit a Support Ticket" size="md">
        <form className="hc-form" onSubmit={handleSubmit}>
          <div className="hc-field">
            <label>Category</label>
            <div className="hc-cats">
              {CATEGORIES.map(c => (
                <button
                  type="button"
                  key={c.value}
                  className={`hc-cat ${category === c.value ? 'hc-cat--active' : ''}`}
                  onClick={() => setCategory(c.value)}
                  disabled={submitting}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="hc-field">
            <label htmlFor="hc-subject">Subject</label>
            <input
              id="hc-subject"
              type="text"
              className="hc-input"
              placeholder="A short summary of the issue"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              maxLength={200}
              disabled={submitting}
              required
            />
          </div>

          <div className="hc-field">
            <label htmlFor="hc-desc">Description</label>
            <textarea
              id="hc-desc"
              className="hc-textarea"
              rows={5}
              placeholder="Tell us what happened, what you expected, and any steps to reproduce."
              value={description}
              onChange={e => setDescription(e.target.value)}
              disabled={submitting}
              required
            />
          </div>

          <div className="hc-field">
            <label>Attachment <span className="hc-field__opt">(optional, max 5MB)</span></label>
            {imagePreview ? (
              <div className="hc-attach-preview">
                <img src={imagePreview} alt="attachment" />
                <button type="button" className="hc-attach-remove" onClick={removeImage} title="Remove" disabled={submitting}>
                  <X size={14} />
                </button>
              </div>
            ) : (
              <label className="hc-attach-drop">
                <ImageIcon size={18} />
                <span>Click to upload an image</span>
                <input type="file" accept="image/*" onChange={handleImageChange} hidden disabled={submitting} />
              </label>
            )}
          </div>

          <div className="hc-form__actions">
            <Button variant="outline" type="button" onClick={closeSubmit} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="gold" type="submit" disabled={submitting}>
              {submitting ? <><Loader2 size={14} className="spin" /> Submitting...</> : <><Send size={14} /> Submit Ticket</>}
            </Button>
          </div>
        </form>
      </Modal>

      {/* View Ticket Modal */}
      <Modal isOpen={!!viewTicket} onClose={() => setViewTicket(null)} title={`Ticket #${viewTicket?.st_id || ''}`} size="md">
        {viewTicket && (
          <div className="hc-view">
            <div className="hc-view__head">
              <h3 className="hc-view__subject">{viewTicket.subject}</h3>
              <span className={`hc-status hc-status--${(STATUS_META[viewTicket.status] || STATUS_META.open).color}`}>
                {React.createElement((STATUS_META[viewTicket.status] || STATUS_META.open).icon, { size: 12 })}
                {(STATUS_META[viewTicket.status] || STATUS_META.open).label}
              </span>
            </div>

            <div className="hc-view__meta">
              <div className="hc-view__meta-item">
                <span className="hc-view__meta-label">Category</span>
                <span className={`hc-cat-tag hc-cat-tag--${viewTicket.category || 'other'}`}>
                  {categoryLabel(viewTicket.category)}
                </span>
              </div>
              <div className="hc-view__meta-item">
                <span className="hc-view__meta-label">Created</span>
                <span className="hc-view__meta-value">{formatDate(viewTicket.created_at)}</span>
              </div>
              {viewTicket.updated_at && viewTicket.updated_at !== viewTicket.created_at && (
                <div className="hc-view__meta-item">
                  <span className="hc-view__meta-label">Last updated</span>
                  <span className="hc-view__meta-value">{formatDate(viewTicket.updated_at)}</span>
                </div>
              )}
            </div>

            <div className="hc-view__section">
              <span className="hc-view__meta-label">Description</span>
              <p className="hc-view__desc">{viewTicket.description}</p>
            </div>

            {viewTicket.image_path && (
              <div className="hc-view__section">
                <span className="hc-view__meta-label">Attachment</span>
                <a href={getFileUrl(viewTicket.image_path)} target="_blank" rel="noreferrer" className="hc-view__image">
                  <img src={getFileUrl(viewTicket.image_path)} alt="ticket attachment" />
                </a>
              </div>
            )}

            <div className="hc-view__actions">
              <Button variant="outline" onClick={() => setViewTicket(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default HelpCenter;
