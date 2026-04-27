import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCRM } from '../../context/CRMContext';
import Header from '../../components/layout/Header';
import { Button } from '../../components/common/Common';
import {
  Save, ArrowLeft, User, Phone, Mail, IndianRupee, Percent,
  Calendar, Building2, Hash, FileText, CheckCircle2, AlertCircle, Calculator,
} from 'lucide-react';
import './AddLoan.css';

const LOAN_TYPES = ['Home Loan', 'Personal Loan', 'Business Loan', 'Auto Loan', 'Education Loan'];
const STATUSES = ['Pending', 'Approved', 'Rejected', 'Active', 'Closed'];

const emptyForm = {
  applicant_name: '',
  applicant_phone: '',
  applicant_email: '',
  loan_amount: '',
  loan_type: 'Home Loan',
  tenure_months: '240',
  interest_rate: '',
  status: 'Pending',
  lender_name: '',
  loan_reference: '',
  approval_date: '',
  start_date: '',
  emi_amount: '',
  notes: '',
};

// EMI formula: P * r * (1+r)^n / ((1+r)^n - 1), r = monthly rate
const calculateEmi = (principal, ratePct, months) => {
  const p = Number(principal || 0);
  const r = Number(ratePct || 0) / 12 / 100;
  const n = Number(months || 0);
  if (p <= 0 || n <= 0) return 0;
  if (r === 0) return p / n;
  const factor = Math.pow(1 + r, n);
  return (p * r * factor) / (factor - 1);
};

const AddLoan = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;
  const { fetchLoans, createLoanRecord, updateLoanRecord } = useCRM();

  const [form, setForm] = useState({ ...emptyForm });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Load loan for editing
  useEffect(() => {
    if (!isEditing) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetchLoans({ limit: 1000 });
        if (res.success) {
          const loan = (res.data || []).find(l => String(l.loan_id) === String(id));
          if (loan) {
            setForm({
              applicant_name: loan.applicant_name || '',
              applicant_phone: loan.applicant_phone || '',
              applicant_email: loan.applicant_email || '',
              loan_amount: loan.loan_amount ?? '',
              loan_type: loan.loan_type || 'Home Loan',
              tenure_months: loan.tenure_months ?? '',
              interest_rate: loan.interest_rate ?? '',
              status: loan.status || 'Pending',
              lender_name: loan.lender_name || '',
              loan_reference: loan.loan_reference || '',
              approval_date: loan.approval_date ? String(loan.approval_date).slice(0, 10) : '',
              start_date: loan.start_date ? String(loan.start_date).slice(0, 10) : '',
              emi_amount: loan.emi_amount ?? '',
              notes: loan.notes || '',
            });
          } else {
            showToast('Loan not found', 'error');
            setTimeout(() => navigate('/loans'), 1000);
          }
        }
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, [id, isEditing, fetchLoans, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(p => ({ ...p, [name]: value }));
    if (errors[name]) setErrors(p => ({ ...p, [name]: '' }));
  };

  const suggestedEmi = useMemo(
    () => calculateEmi(form.loan_amount, form.interest_rate, form.tenure_months),
    [form.loan_amount, form.interest_rate, form.tenure_months]
  );

  const applySuggestedEmi = () => {
    if (suggestedEmi > 0) {
      setForm(p => ({ ...p, emi_amount: suggestedEmi.toFixed(2) }));
    }
  };

  const validate = () => {
    const e = {};
    if (!form.applicant_name.trim()) e.applicant_name = 'Applicant name is required';
    if (!form.applicant_phone.trim()) e.applicant_phone = 'Phone is required';
    else if (!/^\d{7,15}$/.test(form.applicant_phone.replace(/\D/g, ''))) {
      e.applicant_phone = 'Enter a valid phone number (7–15 digits)';
    }
    if (form.applicant_email && !/^\S+@\S+\.\S+$/.test(form.applicant_email)) {
      e.applicant_email = 'Enter a valid email';
    }
    if (form.loan_amount === '' || Number(form.loan_amount) <= 0) {
      e.loan_amount = 'Loan amount is required and must be > 0';
    }
    if (!form.loan_type) e.loan_type = 'Loan type is required';
    if (form.interest_rate && Number(form.interest_rate) < 0) e.interest_rate = 'Cannot be negative';
    if (form.tenure_months && Number(form.tenure_months) <= 0) e.tenure_months = 'Must be > 0';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) {
      showToast('Please fix the highlighted fields', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        loan_amount: Number(form.loan_amount) || 0,
        tenure_months: Number(form.tenure_months) || 0,
        interest_rate: form.interest_rate === '' ? null : Number(form.interest_rate),
        emi_amount: form.emi_amount === '' ? null : Number(form.emi_amount),
        approval_date: form.approval_date || null,
        start_date: form.start_date || null,
      };
      const res = isEditing
        ? await updateLoanRecord(id, payload)
        : await createLoanRecord(payload);

      if (res.success) {
        showToast(isEditing ? 'Loan updated' : 'Loan created');
        setTimeout(() => navigate('/loans'), 800);
      } else {
        showToast(res.message || 'Failed to save loan', 'error');
      }
    } catch {
      showToast('Failed to save loan', 'error');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div>
        <Header title="Loan" subtitle="Loading..." />
        <div className="page"><div className="al-loading">Loading loan...</div></div>
      </div>
    );
  }

  return (
    <div>
      <Header
        title={isEditing ? 'Edit Loan' : 'Add Loan'}
        subtitle={isEditing ? 'Update loan details' : 'Create a new loan application'}
        actions={<Button variant="outline" icon={ArrowLeft} onClick={() => navigate('/loans')}>Back</Button>}
      />
      <div className="page">
        <form className="al-form" onSubmit={handleSubmit}>
          {/* ── Applicant ── */}
          <section className="al-card">
            <div className="al-card__head">
              <div className="al-card__icon"><User size={18} /></div>
              <div>
                <h3>Applicant</h3>
                <p>Who is applying for the loan</p>
              </div>
            </div>
            <div className="al-grid">
              <div className={`al-field ${errors.applicant_name ? 'al-field--error' : ''}`}>
                <label>Applicant Name *</label>
                <div className="al-input"><User size={14} />
                  <input
                    name="applicant_name"
                    value={form.applicant_name}
                    onChange={handleChange}
                    placeholder="Full name"
                    required
                  />
                </div>
                {errors.applicant_name && <span className="al-err"><AlertCircle size={11} /> {errors.applicant_name}</span>}
              </div>

              <div className={`al-field ${errors.applicant_phone ? 'al-field--error' : ''}`}>
                <label>Phone *</label>
                <div className="al-input"><Phone size={14} />
                  <input
                    name="applicant_phone"
                    value={form.applicant_phone}
                    onChange={handleChange}
                    placeholder="e.g. +91 98765 43210"
                    required
                  />
                </div>
                {errors.applicant_phone && <span className="al-err"><AlertCircle size={11} /> {errors.applicant_phone}</span>}
              </div>

              <div className={`al-field ${errors.applicant_email ? 'al-field--error' : ''}`}>
                <label>Email</label>
                <div className="al-input"><Mail size={14} />
                  <input
                    type="email"
                    name="applicant_email"
                    value={form.applicant_email}
                    onChange={handleChange}
                    placeholder="email@example.com"
                  />
                </div>
                {errors.applicant_email && <span className="al-err"><AlertCircle size={11} /> {errors.applicant_email}</span>}
              </div>
            </div>
          </section>

          {/* ── Loan Details ── */}
          <section className="al-card">
            <div className="al-card__head">
              <div className="al-card__icon al-card__icon--gold"><IndianRupee size={18} /></div>
              <div>
                <h3>Loan Details</h3>
                <p>Amount, type & tenure</p>
              </div>
            </div>
            <div className="al-grid">
              <div className={`al-field ${errors.loan_amount ? 'al-field--error' : ''}`}>
                <label>Loan Amount *</label>
                <div className="al-input"><IndianRupee size={14} />
                  <input
                    type="number"
                    name="loan_amount"
                    value={form.loan_amount}
                    onChange={handleChange}
                    placeholder="e.g. 5000000"
                    min="0"
                    required
                  />
                </div>
                {errors.loan_amount && <span className="al-err"><AlertCircle size={11} /> {errors.loan_amount}</span>}
              </div>

              <div className="al-field">
                <label>Loan Type *</label>
                <div className="al-input"><Building2 size={14} />
                  <select name="loan_type" value={form.loan_type} onChange={handleChange} required>
                    {LOAN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div className={`al-field ${errors.tenure_months ? 'al-field--error' : ''}`}>
                <label>Tenure (Months)</label>
                <div className="al-input"><Calendar size={14} />
                  <input
                    type="number"
                    name="tenure_months"
                    value={form.tenure_months}
                    onChange={handleChange}
                    min="0"
                  />
                </div>
                {errors.tenure_months && <span className="al-err"><AlertCircle size={11} /> {errors.tenure_months}</span>}
              </div>

              <div className={`al-field ${errors.interest_rate ? 'al-field--error' : ''}`}>
                <label>Interest Rate (% per year)</label>
                <div className="al-input"><Percent size={14} />
                  <input
                    type="number"
                    step="0.01"
                    name="interest_rate"
                    value={form.interest_rate}
                    onChange={handleChange}
                    placeholder="e.g. 8.5"
                    min="0"
                  />
                </div>
                {errors.interest_rate && <span className="al-err"><AlertCircle size={11} /> {errors.interest_rate}</span>}
              </div>

              <div className="al-field">
                <label>EMI Amount (Monthly)</label>
                <div className="al-input"><IndianRupee size={14} />
                  <input
                    type="number"
                    step="0.01"
                    name="emi_amount"
                    value={form.emi_amount}
                    onChange={handleChange}
                    placeholder="0.00"
                    min="0"
                  />
                </div>
                {suggestedEmi > 0 && (
                  <button type="button" className="al-suggest" onClick={applySuggestedEmi}>
                    <Calculator size={12} /> Use suggested: ₹{suggestedEmi.toFixed(2)}
                  </button>
                )}
              </div>

              <div className="al-field">
                <label>Status</label>
                <div className="al-input"><CheckCircle2 size={14} />
                  <select name="status" value={form.status} onChange={handleChange}>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </section>

          {/* ── Lender ── */}
          <section className="al-card">
            <div className="al-card__head">
              <div className="al-card__icon al-card__icon--blue"><Building2 size={18} /></div>
              <div>
                <h3>Lender & Schedule</h3>
                <p>Bank / NBFC and key dates</p>
              </div>
            </div>
            <div className="al-grid">
              <div className="al-field">
                <label>Lender Name</label>
                <div className="al-input"><Building2 size={14} />
                  <input
                    name="lender_name"
                    value={form.lender_name}
                    onChange={handleChange}
                    placeholder="Bank or NBFC"
                  />
                </div>
              </div>

              <div className="al-field">
                <label>Loan Reference</label>
                <div className="al-input"><Hash size={14} />
                  <input
                    name="loan_reference"
                    value={form.loan_reference}
                    onChange={handleChange}
                    placeholder="Reference number"
                  />
                </div>
              </div>

              <div className="al-field">
                <label>Approval Date</label>
                <div className="al-input"><Calendar size={14} />
                  <input
                    type="date"
                    name="approval_date"
                    value={form.approval_date}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="al-field">
                <label>Start Date</label>
                <div className="al-input"><Calendar size={14} />
                  <input
                    type="date"
                    name="start_date"
                    value={form.start_date}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* ── Notes ── */}
          <section className="al-card">
            <div className="al-card__head">
              <div className="al-card__icon al-card__icon--gray"><FileText size={18} /></div>
              <div>
                <h3>Notes</h3>
                <p>Anything else worth remembering</p>
              </div>
            </div>
            <textarea
              className="al-notes"
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows="4"
              placeholder="Add notes about this loan..."
            />
          </section>

          <div className="al-actions">
            <Button variant="outline" onClick={() => navigate('/loans')}>Cancel</Button>
            <Button variant="gold" icon={Save} type="submit" disabled={saving}>
              {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Loan'}
            </Button>
          </div>
        </form>
      </div>

      {toast && (
        <div className={`al-toast al-toast--${toast.type}`}>{toast.msg}</div>
      )}
    </div>
  );
};

export default AddLoan;
