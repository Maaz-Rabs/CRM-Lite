import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../utils/api';
import Header from '../../components/layout/Header';
import { Button, Modal } from '../../components/common/Common';
import {
  Plus, Edit2, Trash2, Eye, Search, Printer,
  Receipt, Calendar, CheckCircle2, Clock, IndianRupee, FileText, X, Filter
} from 'lucide-react';
import './PaySlip.css';

const todayMonth = () => new Date().toISOString().slice(0, 7);

const emptyForm = () => ({
  u_id: '', period: todayMonth(),
  working_days: 30, present_days: 30,
  basic: '', hra: '', allowances: '', bonus: '',
  deductions: '', tax: '',
  status: 'draft', paid_on: '', notes: '',
});

const INR = (n) => {
  const v = Number(n || 0);
  return '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatPeriod = (p) => {
  if (!p) return '';
  const s = String(p);
  const match = s.match(/(\d{4})-(\d{2})/);
  if (!match) return s;
  const y = Number(match[1]);
  const m = Number(match[2]);
  if (!y || !m || m < 1 || m > 12) return s;
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

const formatDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const PaySlip = () => {
  const { isAdmin } = useAuth();

  const [payslips, setPayslips] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [periodFilter, setPeriodFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const [showView, setShowView] = useState(false);
  const [viewItem, setViewItem] = useState(null);

  const [deleteItem, setDeleteItem] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchPayslips = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (periodFilter) q.append('period', periodFilter);
      if (isAdmin && userFilter) q.append('u_id', userFilter);
      const res = await apiFetch(`payslips${q.toString() ? '?' + q : ''}`);
      if (res.success) setPayslips(Array.isArray(res.data) ? res.data : []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [periodFilter, userFilter, isAdmin]);

  useEffect(() => { fetchPayslips(); }, [fetchPayslips]);

  useEffect(() => {
    if (!isAdmin) return;
    apiFetch('users').then(res => {
      if (res.success) setUsers(Array.isArray(res.data) ? res.data : (res.data?.users || []));
    });
  }, [isAdmin]);

  const computedNet = useMemo(() => {
    const n = (v) => Number(v || 0);
    return Math.max(0, n(formData.basic) + n(formData.hra) + n(formData.allowances) + n(formData.bonus)
                    - n(formData.deductions) - n(formData.tax));
  }, [formData]);

  const filtered = useMemo(() => {
    if (!search.trim()) return payslips;
    const q = search.trim().toLowerCase();
    return payslips.filter(p =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.username || '').toLowerCase().includes(q) ||
      (p.period || '').includes(q)
    );
  }, [payslips, search]);

  const openAdd = () => {
    setEditing(null);
    setFormData(emptyForm());
    setShowForm(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setFormData({
      u_id: p.u_id,
      period: p.period,
      working_days: p.working_days || 0,
      present_days: p.present_days || 0,
      basic: p.basic, hra: p.hra, allowances: p.allowances, bonus: p.bonus,
      deductions: p.deductions, tax: p.tax,
      status: p.status || 'draft',
      paid_on: p.paid_on ? String(p.paid_on).slice(0, 10) : '',
      notes: p.notes || '',
    });
    setShowForm(true);
  };

  const openView = async (p) => {
    try {
      const res = await apiFetch(`payslips/${p.ps_id}`);
      setViewItem(res.success ? res.data : p);
    } catch { setViewItem(p); }
    setShowView(true);
  };

  const handleFormChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!formData.u_id) { showToast('Please select a user', 'error'); return; }
    if (!formData.period) { showToast('Please select a period', 'error'); return; }

    setSaving(true);
    try {
      const endpoint = editing ? `payslips/${editing.ps_id}` : 'payslips';
      const method = editing ? 'PUT' : 'POST';
      const res = await apiFetch(endpoint, {
        method,
        body: JSON.stringify(formData),
      });
      if (res.success) {
        showToast(editing ? 'Payslip updated' : 'Payslip created');
        setShowForm(false);
        fetchPayslips();
      } else {
        showToast(res.message || 'Failed to save', 'error');
      }
    } catch { showToast('Failed to save', 'error'); }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    try {
      const res = await apiFetch(`payslips/${deleteItem.ps_id}`, { method: 'DELETE' });
      if (res.success) { showToast('Payslip deleted'); fetchPayslips(); }
      else showToast(res.message || 'Failed to delete', 'error');
    } catch { showToast('Failed to delete', 'error'); }
    setDeleteItem(null);
  };

  const handlePrint = (p) => {
    const slip = p || viewItem;
    if (!slip) return;

    const gross = Number(slip.basic || 0) + Number(slip.hra || 0) + Number(slip.allowances || 0) + Number(slip.bonus || 0);
    const totalDed = Number(slip.deductions || 0) + Number(slip.tax || 0);
    const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const w = window.open('', 'payslip_print', 'width=820,height=900');
    if (!w) { showToast('Allow popups to print', 'error'); return; }

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Payslip - ${slip.name?.trim() || slip.username || ''} - ${formatPeriod(slip.period)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, 'Segoe UI', Roboto, sans-serif;
      color: #1e293b;
      padding: 36px;
      background: #fff;
      font-size: 13px;
      line-height: 1.5;
    }
    .wrap { max-width: 720px; margin: 0 auto; }
    .head {
      display: flex; justify-content: space-between; align-items: flex-start;
      border-bottom: 3px solid #0f1f3d;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .head__title { font-size: 22px; font-weight: 700; color: #0f1f3d; letter-spacing: -0.02em; }
    .head__sub { font-size: 13px; color: #64748b; margin-top: 4px; }
    .head__right { text-align: right; }
    .head__period { font-size: 14px; font-weight: 600; color: #0f1f3d; }
    .status {
      display: inline-block;
      padding: 3px 10px; border-radius: 12px;
      font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;
      margin-top: 6px;
    }
    .status--paid { background: #d1fae5; color: #047857; }
    .status--draft { background: #fef3c7; color: #b45309; }

    .emp {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;
      padding: 16px; background: #f8f9fb; border-radius: 8px;
      margin-bottom: 24px;
    }
    .emp__label { font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px; }
    .emp__value { font-size: 13.5px; font-weight: 600; color: #1e293b; margin-top: 3px; }

    .split { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
    .col {
      border: 1px solid #e3e7ee; border-radius: 8px; padding: 14px 16px;
    }
    .col h4 {
      font-size: 11px; text-transform: uppercase; font-weight: 700;
      color: #64748b; letter-spacing: 0.6px; margin-bottom: 10px;
    }
    .line { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
    .line span { color: #475569; }
    .line strong { color: #1e293b; font-variant-numeric: tabular-nums; }
    .line--total {
      border-top: 1px dashed #e3e7ee;
      margin-top: 6px; padding-top: 10px;
    }
    .line--total span { font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; color: #64748b; }
    .line--total strong { font-size: 14px; color: #0f172a; }

    .net {
      padding: 20px 24px;
      background: linear-gradient(135deg, #10b981, #22c55e);
      color: #fff;
      border-radius: 10px;
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 20px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .net__label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 600; opacity: 0.92; }
    .net__amt { font-size: 28px; font-weight: 800; margin-top: 4px; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
    .net__words { font-size: 11px; opacity: 0.85; margin-top: 2px; }

    .notes {
      padding: 12px 14px; border: 1px dashed #cdd3de; border-radius: 8px;
      font-size: 12px; color: #475569; background: #f8f9fb;
    }
    .notes__label { font-size: 10px; text-transform: uppercase; font-weight: 700; color: #64748b; letter-spacing: 0.5px; margin-bottom: 4px; display: block; }

    .foot {
      margin-top: 36px; padding-top: 14px;
      border-top: 1px solid #e3e7ee;
      font-size: 10px; color: #94a3b8; text-align: center;
    }

    @media print {
      body { padding: 12px; }
      .wrap { max-width: 100%; }
      @page { margin: 14mm; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="head">
      <div>
        <div class="head__title">Salary Slip</div>
        <div class="head__sub">Pay period: ${formatPeriod(slip.period)}</div>
      </div>
      <div class="head__right">
        <div class="head__period">${slip.name?.trim() || slip.username || ''}</div>
        <div class="head__sub">${slip.role_name || ''}</div>
        <span class="status status--${slip.status}">${slip.status}</span>
      </div>
    </div>

    <div class="emp">
      <div>
        <div class="emp__label">Employee</div>
        <div class="emp__value">${slip.name?.trim() || slip.username || '—'}</div>
      </div>
      <div>
        <div class="emp__label">Role</div>
        <div class="emp__value">${slip.role_name || '—'}</div>
      </div>
      <div>
        <div class="emp__label">Days Worked</div>
        <div class="emp__value">${slip.present_days || 0} / ${slip.working_days || 0}</div>
      </div>
      <div>
        <div class="emp__label">${slip.paid_on ? 'Paid On' : 'Status'}</div>
        <div class="emp__value">${slip.paid_on ? formatDate(slip.paid_on) : slip.status}</div>
      </div>
    </div>

    <div class="split">
      <div class="col">
        <h4>Earnings</h4>
        <div class="line"><span>Basic</span><strong>${inr(slip.basic)}</strong></div>
        <div class="line"><span>HRA</span><strong>${inr(slip.hra)}</strong></div>
        <div class="line"><span>Allowances</span><strong>${inr(slip.allowances)}</strong></div>
        <div class="line"><span>Bonus</span><strong>${inr(slip.bonus)}</strong></div>
        <div class="line line--total"><span>Gross</span><strong>${inr(gross)}</strong></div>
      </div>
      <div class="col">
        <h4>Deductions</h4>
        <div class="line"><span>Deductions</span><strong>${inr(slip.deductions)}</strong></div>
        <div class="line"><span>Tax / TDS</span><strong>${inr(slip.tax)}</strong></div>
        <div class="line line--total"><span>Total</span><strong>${inr(totalDed)}</strong></div>
      </div>
    </div>

    <div class="net">
      <div>
        <div class="net__label">Net Pay</div>
        <div class="net__amt">${inr(slip.net_pay)}</div>
      </div>
      <div style="font-size: 30px; opacity: 0.6;">₹</div>
    </div>

    ${slip.notes ? `<div class="notes"><span class="notes__label">Notes</span>${String(slip.notes).replace(/</g, '&lt;')}</div>` : ''}

    <div class="foot">Generated on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
  </div>
  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;

    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  return (
    <div>
      <Header
        title="PaySlip"
        subtitle={isAdmin ? 'Manage payslips for all team members' : 'View your payslip history'}
        actions={isAdmin ? <Button variant="gold" icon={Plus} onClick={openAdd}>Generate Payslip</Button> : null}
      />
      <div className="page">
        {/* Filters */}
        <div className="ps-filters">
          <div className="ps-filters__search">
            <Search size={15} />
            <input
              placeholder={isAdmin ? 'Search by name or period...' : 'Search by period...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="ps-filters__clear" onClick={() => setSearch('')}><X size={13} /></button>
            )}
          </div>

          <div className="ps-filter">
            <Filter size={14} />
            <label>Period</label>
            <input type="month" value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value)} />
            {periodFilter && (
              <button className="ps-filter__clear" onClick={() => setPeriodFilter('')} title="Clear">
                <X size={12} />
              </button>
            )}
          </div>

          {isAdmin && users.length > 0 && (
            <div className="ps-filter">
              <label>Employee</label>
              <select value={userFilter} onChange={(e) => setUserFilter(e.target.value)}>
                <option value="">All employees</option>
                {users.map(u => (
                  <option key={u.u_id} value={u.u_id}>{u.username || u.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="ps-table-wrap">
          <table className="ps-table">
            <thead>
              <tr>
                <th style={{ width: 50 }}>#</th>
                {isAdmin && <th>Employee</th>}
                <th>Period</th>
                <th>Days</th>
                <th>Net Pay</th>
                <th>Status</th>
                <th style={{ width: 150, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" className="ps-empty">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan="7" className="ps-empty">
                  <div className="ps-empty-state">
                    <div className="ps-empty-state__icon"><Receipt size={28} /></div>
                    <p className="ps-empty-state__title">
                      {payslips.length === 0
                        ? (isAdmin ? 'No payslips yet' : 'No payslips available')
                        : 'No matching payslips'}
                    </p>
                    <p className="ps-empty-state__sub">
                      {payslips.length === 0 && isAdmin
                        ? 'Click "Generate Payslip" to create the first one.'
                        : payslips.length === 0
                        ? 'Your payslips will appear here once they are generated.'
                        : 'Try a different search or filter.'}
                    </p>
                  </div>
                </td></tr>
              ) : (
                filtered.map((p, idx) => (
                  <tr key={p.ps_id} className="ps-row">
                    <td className="ps-num"><span>{idx + 1}</span></td>
                    {isAdmin && (
                      <td>
                        <div className="ps-emp">
                          <div className="ps-emp__avatar">
                            {(p.name || p.username || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                          </div>
                          <div>
                            <div className="ps-emp__name">{p.name?.trim() || p.username}</div>
                            <div className="ps-emp__role">{p.role_name || ''}</div>
                          </div>
                        </div>
                      </td>
                    )}
                    <td><span className="ps-period"><Calendar size={12} /> {formatPeriod(p.period)}</span></td>
                    <td><span className="ps-days">{p.present_days}/{p.working_days}</span></td>
                    <td><span className="ps-net">{INR(p.net_pay)}</span></td>
                    <td>
                      <span className={`ps-status ps-status--${p.status}`}>
                        {p.status === 'paid' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                        {p.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="ps-actions">
                        <button className="ps-btn" title="View" onClick={() => openView(p)}><Eye size={14} /></button>
                        {isAdmin && (
                          <>
                            <button className="ps-btn" title="Edit" onClick={() => openEdit(p)}><Edit2 size={14} /></button>
                            <button className="ps-btn ps-btn--danger" title="Delete" onClick={() => setDeleteItem(p)}><Trash2 size={14} /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Create / Edit Modal ── */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editing ? 'Edit Payslip' : 'Generate Payslip'} size="md">
        <div className="ps-form">
          <div className="ps-form__grid">
            {!editing && (
              <div className="ps-form__field">
                <label>Employee *</label>
                <select
                  value={formData.u_id}
                  onChange={(e) => handleFormChange('u_id', e.target.value)}
                >
                  <option value="">Select employee...</option>
                  {users.map(u => (
                    <option key={u.u_id} value={u.u_id}>
                      {u.username || u.name} {u.role_name ? `(${u.role_name})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="ps-form__field">
              <label>Pay Period *</label>
              <input
                type="month"
                value={formData.period}
                onChange={(e) => handleFormChange('period', e.target.value)}
              />
            </div>
            <div className="ps-form__field">
              <label>Working Days</label>
              <input type="number" min="0" max="31" value={formData.working_days}
                onChange={(e) => handleFormChange('working_days', e.target.value)} />
            </div>
            <div className="ps-form__field">
              <label>Present Days</label>
              <input type="number" min="0" max="31" value={formData.present_days}
                onChange={(e) => handleFormChange('present_days', e.target.value)} />
            </div>
          </div>

          <div className="ps-form__section">Earnings</div>
          <div className="ps-form__grid">
            <div className="ps-form__field">
              <label>Basic</label>
              <input type="number" min="0" step="0.01" value={formData.basic}
                onChange={(e) => handleFormChange('basic', e.target.value)} placeholder="0.00" />
            </div>
            <div className="ps-form__field">
              <label>HRA</label>
              <input type="number" min="0" step="0.01" value={formData.hra}
                onChange={(e) => handleFormChange('hra', e.target.value)} placeholder="0.00" />
            </div>
            <div className="ps-form__field">
              <label>Allowances</label>
              <input type="number" min="0" step="0.01" value={formData.allowances}
                onChange={(e) => handleFormChange('allowances', e.target.value)} placeholder="0.00" />
            </div>
            <div className="ps-form__field">
              <label>Bonus</label>
              <input type="number" min="0" step="0.01" value={formData.bonus}
                onChange={(e) => handleFormChange('bonus', e.target.value)} placeholder="0.00" />
            </div>
          </div>

          <div className="ps-form__section">Deductions</div>
          <div className="ps-form__grid">
            <div className="ps-form__field">
              <label>Deductions</label>
              <input type="number" min="0" step="0.01" value={formData.deductions}
                onChange={(e) => handleFormChange('deductions', e.target.value)} placeholder="0.00" />
            </div>
            <div className="ps-form__field">
              <label>Tax / TDS</label>
              <input type="number" min="0" step="0.01" value={formData.tax}
                onChange={(e) => handleFormChange('tax', e.target.value)} placeholder="0.00" />
            </div>
          </div>

          <div className="ps-net-preview">
            <span>Net Pay</span>
            <strong>{INR(computedNet)}</strong>
          </div>

          <div className="ps-form__grid">
            <div className="ps-form__field">
              <label>Status</label>
              <select value={formData.status} onChange={(e) => handleFormChange('status', e.target.value)}>
                <option value="draft">Draft</option>
                <option value="paid">Paid</option>
              </select>
            </div>
            {formData.status === 'paid' && (
              <div className="ps-form__field">
                <label>Paid On</label>
                <input type="date" value={formData.paid_on}
                  onChange={(e) => handleFormChange('paid_on', e.target.value)} />
              </div>
            )}
          </div>

          <div className="ps-form__field">
            <label>Notes</label>
            <textarea rows="2" value={formData.notes}
              onChange={(e) => handleFormChange('notes', e.target.value)}
              placeholder="Any additional notes..." />
          </div>

          <div className="modal__actions">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button variant="gold" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── View Modal ── */}
      <Modal isOpen={showView} onClose={() => setShowView(false)} title="Payslip" size="md">
        {viewItem && (() => {
          const gross = Number(viewItem.basic || 0) + Number(viewItem.hra || 0) + Number(viewItem.allowances || 0) + Number(viewItem.bonus || 0);
          const totalDed = Number(viewItem.deductions || 0) + Number(viewItem.tax || 0);
          return (
          <div className="ps-view">
            {/* Hero header */}
            <div className="ps-view__hero">
              <div className="ps-view__hero-bg" />
              <div className="ps-view__hero-content">
                <div className="ps-view__hero-left">
                  <div className="ps-view__hero-logo"><Receipt size={20} /></div>
                  <div>
                    <div className="ps-view__hero-title">Salary Slip</div>
                    <div className="ps-view__hero-sub">Pay period · {formatPeriod(viewItem.period)}</div>
                  </div>
                </div>
                <span className={`ps-view__hero-badge ps-view__hero-badge--${viewItem.status}`}>
                  {viewItem.status === 'paid' ? <CheckCircle2 size={13} /> : <Clock size={13} />}
                  {viewItem.status}
                </span>
              </div>
            </div>

            {/* Employee identity */}
            <div className="ps-view__identity">
              <div className="ps-view__avatar">
                {(viewItem.name?.trim() || viewItem.username || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
              </div>
              <div className="ps-view__identity-main">
                <div className="ps-view__identity-name">{viewItem.name?.trim() || viewItem.username}</div>
                <div className="ps-view__identity-role">{viewItem.role_name || '—'}</div>
              </div>
              <div className="ps-view__identity-meta">
                <div className="ps-view__meta-item">
                  <span className="ps-view__meta-label">Days Worked</span>
                  <span className="ps-view__meta-value">{viewItem.present_days || 0} / {viewItem.working_days || 0}</span>
                </div>
                {viewItem.paid_on && (
                  <div className="ps-view__meta-item">
                    <span className="ps-view__meta-label">Paid On</span>
                    <span className="ps-view__meta-value">{formatDate(viewItem.paid_on)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Earnings + Deductions grid */}
            <div className="ps-view__split">
              <div className="ps-view__col">
                <h4 className="ps-view__col-title">
                  <span className="ps-view__col-dot ps-view__col-dot--up" />
                  Earnings
                </h4>
                <div className="ps-view__row"><span>Basic</span><strong>{INR(viewItem.basic)}</strong></div>
                <div className="ps-view__row"><span>HRA</span><strong>{INR(viewItem.hra)}</strong></div>
                <div className="ps-view__row"><span>Allowances</span><strong>{INR(viewItem.allowances)}</strong></div>
                <div className="ps-view__row"><span>Bonus</span><strong>{INR(viewItem.bonus)}</strong></div>
                <div className="ps-view__row ps-view__row--total">
                  <span>Gross</span>
                  <strong>{INR(gross)}</strong>
                </div>
              </div>
              <div className="ps-view__col">
                <h4 className="ps-view__col-title">
                  <span className="ps-view__col-dot ps-view__col-dot--down" />
                  Deductions
                </h4>
                <div className="ps-view__row"><span>Deductions</span><strong>{INR(viewItem.deductions)}</strong></div>
                <div className="ps-view__row"><span>Tax / TDS</span><strong>{INR(viewItem.tax)}</strong></div>
                <div className="ps-view__row ps-view__row--total">
                  <span>Total</span>
                  <strong>{INR(totalDed)}</strong>
                </div>
              </div>
            </div>

            <div className="ps-view__net">
              <div>
                <div className="ps-view__label">Net Pay</div>
                <div className="ps-view__net-amount">{INR(viewItem.net_pay)}</div>
              </div>
              <IndianRupee size={24} />
            </div>

            {viewItem.notes && (
              <div className="ps-view__notes">
                <span className="ps-view__label"><FileText size={12} /> Notes</span>
                <p>{viewItem.notes}</p>
              </div>
            )}

            <div className="modal__actions ps-view__actions">
              <Button variant="outline" icon={Printer} onClick={() => handlePrint(viewItem)}>Print</Button>
              <Button variant="outline" onClick={() => setShowView(false)}>Close</Button>
            </div>
          </div>
          );
        })()}
      </Modal>

      {/* ── Delete Confirm ── */}
      <Modal isOpen={!!deleteItem} onClose={() => setDeleteItem(null)} title="Delete Payslip" size="sm">
        {deleteItem && (
          <div>
            <p style={{ color: 'var(--gray-600)', marginBottom: 20 }}>
              Delete payslip for <strong>{deleteItem.name?.trim() || deleteItem.username}</strong> — <strong>{formatPeriod(deleteItem.period)}</strong>?
            </p>
            <div className="modal__actions">
              <Button variant="outline" onClick={() => setDeleteItem(null)}>Cancel</Button>
              <Button variant="danger" icon={Trash2} onClick={handleDelete}>Delete</Button>
            </div>
          </div>
        )}
      </Modal>

      {toast && <div className={`ps-toast ps-toast--${toast.type}`}>{toast.msg}</div>}
    </div>
  );
};

export default PaySlip;
