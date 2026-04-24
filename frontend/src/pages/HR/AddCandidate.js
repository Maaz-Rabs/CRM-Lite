import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiFetch } from '../../utils/api';
import Header from '../../components/layout/Header';
import { Button, FormInput, FormSelect } from '../../components/common/Common';
import { Save, RotateCcw, Upload, X, FileText, ArrowLeft } from 'lucide-react';
import '../../pages/Leads/subpages/AddLead.css';

const COUNTRY_CODES = [
  { value: '+91', label: '🇮🇳 +91' },
  { value: '+971', label: '🇦🇪 +971' },
  { value: '+974', label: '🇶🇦 +974' },
  { value: '+1', label: '🇺🇸 +1' },
  { value: '+44', label: '🇬🇧 +44' },
];

const emptyForm = {
  name: '', email: '', country_code: '+91', mobile: '',
  alt_country_code: '+91', alt_mobile: '',
  source_id: '', position_id: '', status_id: '',
  date_of_birth: '', location: '', notes: '',
};

const AddCandidate = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;
  const fileRef = useRef(null);

  const [form, setForm] = useState({ ...emptyForm });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [cvFile, setCvFile] = useState(null);
  const [toast, setToast] = useState(null);

  const [sources, setSources] = useState([]);
  const [positions, setPositions] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [otherInputs, setOtherInputs] = useState({ source: '', position: '', status: '' });
  const [savingOther, setSavingOther] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(p => {
      const updated = { ...p, [name]: value };
      // Only one "other" open at a time
      if (value === 'other') {
        if (name === 'source_id') { if (p.position_id === 'other') updated.position_id = ''; if (p.status_id === 'other') updated.status_id = ''; }
        if (name === 'position_id') { if (p.source_id === 'other') updated.source_id = ''; if (p.status_id === 'other') updated.status_id = ''; }
        if (name === 'status_id') { if (p.source_id === 'other') updated.source_id = ''; if (p.position_id === 'other') updated.position_id = ''; }
      }
      return updated;
    });
    if (errors[name]) setErrors(p => ({ ...p, [name]: '' }));
  };

  const handleOtherSave = async (field, type, setter) => {
    const val = otherInputs[field]?.trim();
    if (!val) return;
    setSavingOther(p => ({ ...p, [field]: true }));
    try {
      const res = await apiFetch(`candidate-options/${type}`, {
        method: 'POST',
        body: JSON.stringify({ name: val }),
      });
      if (res.success && res.data) {
        const newId = String(res.data.id);
        // Refresh options
        const listRes = await apiFetch(`candidate-options/${type}`);
        if (listRes.success) setter(Array.isArray(listRes.data) ? listRes.data : []);
        setForm(p => ({ ...p, [`${field}_id`]: newId }));
        setOtherInputs(p => ({ ...p, [field]: '' }));
      }
    } catch (e) {}
    setSavingOther(p => ({ ...p, [field]: false }));
  };

  // Fetch dynamic fields
  useEffect(() => {
    const fetchOpts = async (type, setter) => {
      try {
        const res = await apiFetch(`candidate-options/${type}`);
        if (res.success && res.data) setter(Array.isArray(res.data) ? res.data : res.data.items || []);
      } catch (e) {}
    };
    fetchOpts('candidates_source', setSources);
    fetchOpts('candidates_post', setPositions);
    fetchOpts('candidates_status', setStatuses);
  }, []);

  // Load candidate for edit
  useEffect(() => {
    if (!isEditing) return;
    (async () => {
      try {
        const res = await apiFetch(`candidates/${id}`);
        if (res.success && res.data) {
          const c = res.data;
          setForm({
            name: c.name || '', email: c.email || '',
            country_code: c.country_code || '+91', mobile: c.mobile || '',
            alt_country_code: c.alt_country_code || '+91', alt_mobile: c.alt_mobile || '',
            source_id: c.source_id ? String(c.source_id) : '',
            position_id: c.position_id ? String(c.position_id) : '',
            status_id: c.status_id ? String(c.status_id) : '',
            date_of_birth: c.date_of_birth ? c.date_of_birth.split('T')[0] : '',
            location: c.location || '', notes: c.notes || '',
          });
        }
      } catch (e) {}
    })();
  }, [id, isEditing]);

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.mobile.trim()) e.mobile = 'Mobile is required';
    else if (!/^\d{7,15}$/.test(form.mobile.trim())) e.mobile = 'Enter valid mobile';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter valid email';
    if (!form.source_id || form.source_id === 'other') e.source_id = 'Source is required';
    if (!form.position_id || form.position_id === 'other') e.position_id = 'Position is required';
    if (!form.status_id || form.status_id === 'other') e.status_id = 'Status is required';
    setErrors(e);
    return { valid: Object.keys(e).length === 0, firstKey: Object.keys(e)[0] };
  };

  const handleSubmit = async () => {
    const { valid, firstKey } = validate();
    if (!valid) {
      setToast({ type: 'error', msg: 'Please fix the errors below' });
      setTimeout(() => setToast(null), 3000);
      setTimeout(() => {
        const el = document.querySelector(`[name="${firstKey}"]`);
        if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus(); }
      }, 50);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        source_id: form.source_id ? parseInt(form.source_id) : null,
        position_id: form.position_id ? parseInt(form.position_id) : null,
        status_id: form.status_id ? parseInt(form.status_id) : null,
        date_of_birth: form.date_of_birth || null,
      };

      const res = await apiFetch(isEditing ? `candidates/${id}` : 'candidates', {
        method: isEditing ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });

      if (res.success) {
        const candId = isEditing ? id : res.data?.cand_id;
        if (cvFile && candId) {
          const fd = new FormData();
          fd.append('document', cvFile);
          await apiFetch(`candidates/${candId}/cv`, { method: 'POST', body: fd });
        }
        setToast({ type: 'success', msg: isEditing ? 'Candidate updated!' : 'Candidate created!' });
        setTimeout(() => navigate('/hr/candidates'), 1200);
      } else {
        setToast({ type: 'error', msg: res.message || 'Failed to save' });
      }
    } catch (err) {
      setToast({ type: 'error', msg: 'Failed to save candidate' });
    }
    setSaving(false);
    setTimeout(() => setToast(null), 3000);
  };

  const handleReset = () => { setForm({ ...emptyForm }); setErrors({}); setCvFile(null); };

  return (
    <div>
      <Header
        title={isEditing ? 'Edit Candidate' : 'Add New Candidate'}
        subtitle={isEditing ? 'Update candidate details' : 'Fill in the details to register a new candidate'}
        actions={<Button variant="outline" icon={ArrowLeft} onClick={() => navigate('/hr/candidates')}>Back</Button>}
      />
      <div className="page">
        <div className="add-lead-form" style={{ maxWidth: 1000 }}>

          {/* ── Personal Details ── */}
          <div className="add-lead-section">
            <h3 className="add-lead-section__title">Personal Details</h3>
            <div className="form-row">
              <FormInput label="Candidate Name *" name="name" value={form.name} onChange={handleChange} placeholder="Enter full name" error={errors.name} />
              <FormInput label="Email Id." name="email" type="email" value={form.email} onChange={handleChange} placeholder="Enter Email Id." error={errors.email} />
            </div>
            <div className="form-row">
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ width: 110 }}>
                  <FormSelect label="Mobile No. *" name="country_code" value={form.country_code} onChange={handleChange} options={COUNTRY_CODES} />
                </div>
                <div style={{ flex: 1 }}>
                  <FormInput label="&nbsp;" name="mobile" value={form.mobile} onChange={handleChange} placeholder="+91" error={errors.mobile} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ width: 110 }}>
                  <FormSelect label="Alt Mobile No." name="alt_country_code" value={form.alt_country_code} onChange={handleChange} options={COUNTRY_CODES} />
                </div>
                <div style={{ flex: 1 }}>
                  <FormInput label="&nbsp;" name="alt_mobile" value={form.alt_mobile} onChange={handleChange} placeholder="+91" />
                </div>
              </div>
            </div>
            <div className="form-row">
              <FormInput label="Date of Birth" name="date_of_birth" type="date" value={form.date_of_birth} onChange={handleChange} />
              <FormInput label="Location *" name="location" value={form.location} onChange={handleChange} placeholder="Search location..." error={errors.location} />
            </div>
          </div>

          {/* ── Candidate Details ── */}
          <div className="add-lead-section">
            <h3 className="add-lead-section__title">Candidate Details</h3>
            <div className="form-row">
              <div className="form-group">
                <FormSelect label="Candidate Source *" name="source_id" value={form.source_id} onChange={handleChange}
                  options={[...(sources || []).map(s => ({ value: s.cs_id || s.id || s.df_id, label: s.name || s.label || s.value })), { value: 'other', label: '+ Other (Add New)' }]}
                  placeholder="Select Source" error={errors.source_id} />
                {form.source_id === 'other' && (
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginTop: 8 }}>
                    <div style={{ flex: 1 }}>
                      <FormInput name="_other_source" value={otherInputs.source} onChange={(e) => setOtherInputs(p => ({ ...p, source: e.target.value }))} placeholder="Enter new source name" />
                    </div>
                    <button type="button" onClick={() => handleOtherSave('source', 'candidates_source', setSources)} disabled={savingOther.source}
                      style={{ height: 42, padding: '0 20px', borderRadius: 8, border: 'none', background: 'var(--gold-500)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap', marginBottom: 16 }}>
                      {savingOther.source ? '...' : 'Add'}
                    </button>
                  </div>
                )}
              </div>
              <div className="form-group">
                <FormSelect label="Candidate Position *" name="position_id" value={form.position_id} onChange={handleChange}
                  options={[...(positions || []).map(p => ({ value: p.cp_id || p.id || p.df_id, label: p.name || p.label || p.value })), { value: 'other', label: '+ Other (Add New)' }]}
                  placeholder="Select Position" error={errors.position_id} />
                {form.position_id === 'other' && (
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginTop: 8 }}>
                    <div style={{ flex: 1 }}>
                      <FormInput name="_other_position" value={otherInputs.position} onChange={(e) => setOtherInputs(p => ({ ...p, position: e.target.value }))} placeholder="Enter new position name" />
                    </div>
                    <button type="button" onClick={() => handleOtherSave('position', 'candidates_post', setPositions)} disabled={savingOther.position}
                      style={{ height: 42, padding: '0 20px', borderRadius: 8, border: 'none', background: 'var(--gold-500)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap', marginBottom: 16 }}>
                      {savingOther.position ? '...' : 'Add'}
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <FormSelect label="Candidate Status *" name="status_id" value={form.status_id} onChange={handleChange}
                  options={[...(statuses || []).map(s => ({ value: s.cst_id || s.id || s.df_id, label: s.name || s.label || s.value })), { value: 'other', label: '+ Other (Add New)' }]}
                  placeholder="Select Status" error={errors.status_id} />
                {form.status_id === 'other' && (
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginTop: 8 }}>
                    <div style={{ flex: 1 }}>
                      <FormInput name="_other_status" value={otherInputs.status} onChange={(e) => setOtherInputs(p => ({ ...p, status: e.target.value }))} placeholder="Enter new status name" />
                    </div>
                    <button type="button" onClick={() => handleOtherSave('status', 'candidates_status', setStatuses)} disabled={savingOther.status}
                      style={{ height: 42, padding: '0 20px', borderRadius: 8, border: 'none', background: 'var(--gold-500)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap', marginBottom: 16 }}>
                      {savingOther.status ? '...' : 'Add'}
                    </button>
                  </div>
                )}
              </div>
              <div />
            </div>
          </div>

          {/* ── Additional Info & CV ── */}
          <div className="add-lead-section">
            <h3 className="add-lead-section__title">Additional Info & CV</h3>
            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Notes</label>
                <textarea className="form-textarea" name="notes" value={form.notes} onChange={handleChange}
                  placeholder="Any additional notes..." rows={3} style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13, resize: 'vertical', fontFamily: 'inherit' }} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Upload CV</label>
                {cvFile ? (
                  <div className="add-lead-file-preview">
                    <FileText size={18} color="var(--gold-500)" />
                    <span className="add-lead-file-name">{cvFile.name}</span>
                    <button type="button" className="add-lead-file-remove" onClick={() => setCvFile(null)}><X size={14} /></button>
                  </div>
                ) : (
                  <div className="add-lead-upload" onClick={() => fileRef.current?.click()}>
                    <Upload size={22} color="var(--gray-400)" />
                    <span>Click to upload CV (PDF/DOC)</span>
                    <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" onChange={(e) => setCvFile(e.target.files?.[0])} hidden />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Actions ── */}
          <div className="add-lead-actions">
            <Button variant="outline" icon={RotateCcw} onClick={handleReset}>Reset</Button>
            <Button variant="gold" icon={Save} onClick={handleSubmit} disabled={saving}>
              {saving ? 'Saving...' : isEditing ? 'Update Candidate' : 'Save Candidate'}
            </Button>
          </div>
        </div>
      </div>

      {toast && <div style={{ position: 'fixed', bottom: 24, right: 24, padding: '12px 20px', borderRadius: 10, background: toast.type === 'success' ? '#22c55e' : '#ef4444', color: '#fff', fontSize: 13, fontWeight: 600, zIndex: 9999, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>{toast.msg}</div>}
    </div>
  );
};

export default AddCandidate;
