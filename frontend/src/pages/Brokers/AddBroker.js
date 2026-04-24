import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiFetch } from '../../utils/api';
import Header from '../../components/layout/Header';
import { Button } from '../../components/common/Common';
import { Save, ArrowLeft, Upload, X } from 'lucide-react';

const COUNTRY_CODES = [
  { code: '+91', label: '🇮🇳 +91' },
  { code: '+971', label: '🇦🇪 +971' },
  { code: '+974', label: '🇶🇦 +974' },
  { code: '+1', label: '🇺🇸 +1' },
  { code: '+44', label: '🇬🇧 +44' },
];

const AddBroker = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [errors, setErrors] = useState({});
  const [document, setDocument] = useState(null);
  const [profilePhoto, setProfilePhoto] = useState(null);

  const [form, setForm] = useState({
    broker_name: '', broker_email: '', country_code: '+971', mobile_no: '',
    company: '', rera_no: '', location: '', address: '', remark: '',
    status: 'active', specialization: 'both', commission_percentage: '0',
    experience_years: '0', license_expiry_date: '', languages: '',
  });

  // Load broker data if editing
  React.useEffect(() => {
    if (isEditing) {
      (async () => {
        try {
          const res = await apiFetch(`brokers/${id}`);
          if (res.success && res.data) {
            const b = res.data;
            setForm({
              broker_name: b.broker_name || '',
              broker_email: b.broker_email || '',
              country_code: b.country_code || '+971',
              mobile_no: b.mobile_no || '',
              company: b.company || '',
              rera_no: b.rera_no || '',
              location: b.location || '',
              address: b.address || '',
              remark: b.remark || '',
              status: b.status || 'active',
              specialization: b.specialization || 'both',
              commission_percentage: String(b.commission_percentage || 0),
              experience_years: String(b.experience_years || 0),
              license_expiry_date: b.license_expiry_date ? b.license_expiry_date.split('T')[0] : '',
              languages: Array.isArray(b.languages) ? b.languages.join(', ') : (b.languages || ''),
            });
          }
        } catch (err) {
          console.error('Load broker error:', err);
        }
      })();
    }
  }, [id, isEditing]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(p => ({ ...p, [name]: value }));
    if (errors[name]) setErrors(p => ({ ...p, [name]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!form.broker_name.trim()) newErrors.broker_name = 'Broker name is required';
    if (!form.mobile_no.trim()) newErrors.mobile_no = 'Mobile number is required';
    else if (!/^\d{7,15}$/.test(form.mobile_no.trim())) newErrors.mobile_no = 'Enter a valid mobile number';
    if (!form.company.trim()) newErrors.company = 'Company name is required';
    if (!form.rera_no.trim()) newErrors.rera_no = 'RERA number is required';
    if (!form.address.trim()) newErrors.address = 'Address is required';
    if (form.broker_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.broker_email)) newErrors.broker_email = 'Enter a valid email';

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      setToast({ type: 'error', message: 'Please fix the errors below' });
      setTimeout(() => setToast(null), 3000);
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([k, v]) => formData.append(k, v));
      if (document) formData.append('document', document);
      if (profilePhoto) formData.append('profile_photo', profilePhoto);

      const endpoint = isEditing ? `brokers/${id}` : 'brokers';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await apiFetch(endpoint, { method, body: formData });
      if (res.success) {
        setToast({ type: 'success', message: isEditing ? 'Broker updated!' : 'Broker created!' });
        setTimeout(() => navigate('/brokers'), 1500);
      } else {
        setToast({ type: 'error', message: res.message || 'Failed to save' });
      }
    } catch (err) {
      setToast({ type: 'error', message: 'Failed to save broker' });
    }
    setSaving(false);
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div>
      <Header
        title={isEditing ? 'Edit Broker' : 'Add Broker'}
        subtitle={isEditing ? 'Update broker details' : 'Register a new broker'}
        actions={<Button variant="outline" icon={ArrowLeft} onClick={() => navigate('/brokers')}>Back</Button>}
      />
      <div className="page">
        <form className="ab-layout" onSubmit={handleSubmit}>
        <div className="ab-layout__left">
          {/* Personal Details */}
          <div className="ab-section">
            <h3 className="ab-section__title">Personal Details</h3>
            <div className="ab-section__grid">
              <div className="ab-field">
                <label className="ab-field__label">Broker Name <span className="ab-field__req">*</span></label>
                <input className={`ab-field__input ${errors.broker_name ? 'ab-field__input--error' : ''}`} name="broker_name" value={form.broker_name} onChange={handleChange} placeholder="Full name" />
                {errors.broker_name && <span className="ab-field__error">{errors.broker_name}</span>}
              </div>
              <div className="ab-field">
                <label className="ab-field__label">Mobile No. <span className="ab-field__req">*</span></label>
                <div className="ab-field__phone">
                  <select className="ab-field__code" name="country_code" value={form.country_code} onChange={handleChange}>
                    {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                  </select>
                  <input className={`ab-field__input ${errors.mobile_no ? 'ab-field__input--error' : ''}`} type="tel" name="mobile_no" value={form.mobile_no} onChange={handleChange} placeholder="Mobile number" />
                </div>
                {errors.mobile_no && <span className="ab-field__error">{errors.mobile_no}</span>}
              </div>
              <div className="ab-field">
                <label className="ab-field__label">Email</label>
                <input className={`ab-field__input ${errors.broker_email ? 'ab-field__input--error' : ''}`} type="email" name="broker_email" value={form.broker_email} onChange={handleChange} placeholder="email@example.com" />
                {errors.broker_email && <span className="ab-field__error">{errors.broker_email}</span>}
              </div>
              <div className="ab-field">
                <label className="ab-field__label">Company <span className="ab-field__req">*</span></label>
                <input className={`ab-field__input ${errors.company ? 'ab-field__input--error' : ''}`} name="company" value={form.company} onChange={handleChange} placeholder="Company name" />
                {errors.company && <span className="ab-field__error">{errors.company}</span>}
              </div>
              <div className="ab-field">
                <label className="ab-field__label">RERA No. <span className="ab-field__req">*</span></label>
                <input className={`ab-field__input ${errors.rera_no ? 'ab-field__input--error' : ''}`} name="rera_no" value={form.rera_no} onChange={handleChange} placeholder="RERA certificate number" />
                {errors.rera_no && <span className="ab-field__error">{errors.rera_no}</span>}
              </div>
              <div className="ab-field">
                <label className="ab-field__label">Specialization</label>
                <select className="ab-field__input ab-field__select" name="specialization" value={form.specialization} onChange={handleChange}>
                  <option value="residential">Residential</option>
                  <option value="commercial">Commercial</option>
                  <option value="both">Both</option>
                </select>
              </div>
            </div>
          </div>

          {/* Business Details */}
          <div className="ab-section">
            <h3 className="ab-section__title">Business Details</h3>
            <div className="ab-section__grid">
              <div className="ab-field">
                <label className="ab-field__label">Commission %</label>
                <input className="ab-field__input" type="number" name="commission_percentage" value={form.commission_percentage} onChange={handleChange} placeholder="0" min="0" max="100" step="0.01" />
              </div>
              <div className="ab-field">
                <label className="ab-field__label">Experience (Years)</label>
                <input className="ab-field__input" type="number" name="experience_years" value={form.experience_years} onChange={handleChange} placeholder="0" min="0" />
              </div>
              <div className="ab-field">
                <label className="ab-field__label">License Expiry</label>
                <input className="ab-field__input" type="date" name="license_expiry_date" value={form.license_expiry_date} onChange={handleChange} />
              </div>
              <div className="ab-field">
                <label className="ab-field__label">Languages</label>
                <input className="ab-field__input" name="languages" value={form.languages} onChange={handleChange} placeholder="e.g. English, Hindi, Arabic" />
              </div>
              <div className="ab-field">
                <label className="ab-field__label">Status</label>
                <select className="ab-field__input ab-field__select" name="status" value={form.status} onChange={handleChange}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
              <div className="ab-field">
                <label className="ab-field__label">Location</label>
                <input className="ab-field__input" name="location" value={form.location} onChange={handleChange} placeholder="e.g. Downtown, Marina" />
              </div>
            </div>
          </div>

          {/* Address & Notes */}
          <div className="ab-section">
            <h3 className="ab-section__title">Address & Notes</h3>
            <div className="ab-section__grid ab-section__grid--full">
              <div className="ab-field">
                <label className="ab-field__label">Address <span className="ab-field__req">*</span></label>
                <textarea className={`ab-field__input ab-field__textarea ${errors.address ? 'ab-field__input--error' : ''}`} name="address" value={form.address} onChange={handleChange} placeholder="Full address" rows={3} />
                {errors.address && <span className="ab-field__error">{errors.address}</span>}
              </div>
              <div className="ab-field">
                <label className="ab-field__label">Remark</label>
                <textarea className="ab-field__input ab-field__textarea" name="remark" value={form.remark} onChange={handleChange} placeholder="Any remarks..." rows={3} />
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="ab-actions">
            <Button variant="outline" type="button" onClick={() => navigate('/brokers')}>Cancel</Button>
            <Button variant="gold" icon={Save} type="submit" disabled={saving}>
              {saving ? 'Saving...' : (isEditing ? 'Update Broker' : 'Add Broker')}
            </Button>
          </div>
        </div>

        {/* Right Side — Documents */}
        <div className="ab-layout__right">
          <div className="ab-section ab-section--sticky">
            <h3 className="ab-section__title">Documents</h3>
            <div className="ab-field" style={{ marginBottom: 16 }}>
              <label className="ab-field__label">Document (PDF/Image)</label>
              {document ? (
                <div className="ab-file-preview">
                  <span>{document.name}</span>
                  <button type="button" onClick={() => setDocument(null)}><X size={14} /></button>
                </div>
              ) : (
                <label className="ab-upload-box">
                  <Upload size={20} />
                  <span>Click to upload</span>
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={(e) => setDocument(e.target.files[0])} hidden />
                </label>
              )}
            </div>
            <div className="ab-field">
              <label className="ab-field__label">Profile Photo</label>
              {profilePhoto ? (
                <div className="ab-file-preview">
                  <span>{profilePhoto.name}</span>
                  <button type="button" onClick={() => setProfilePhoto(null)}><X size={14} /></button>
                </div>
              ) : (
                <label className="ab-upload-box">
                  <Upload size={20} />
                  <span>Click to upload</span>
                  <input type="file" accept=".jpg,.jpeg,.png,.webp" onChange={(e) => setProfilePhoto(e.target.files[0])} hidden />
                </label>
              )}
            </div>
          </div>
        </div>
        </form>
      </div>

      {toast && <div className={`broker-toast broker-toast--${toast.type}`}>{toast.message}</div>}
    </div>
  );
};

export default AddBroker;
