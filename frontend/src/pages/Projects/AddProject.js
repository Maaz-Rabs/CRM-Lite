import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiFetch } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import Header from '../../components/layout/Header';
import { Button } from '../../components/common/Common';
import MediaUploader from '../../components/common/MediaUploader';
import { Save, ArrowLeft, ChevronDown } from 'lucide-react';
import './AddProject.css';

const AMENITIES_LIST = [
  'Swimming Pool', 'Gym', 'Clubhouse', 'Garden', 'Parking', 'Security',
  'Lift', 'Power Backup', 'CCTV', 'Play Area', 'Intercom', 'Fire Safety',
  'Gas Pipeline', 'Rain Water Harvesting', 'Jogging Track', 'Indoor Games',
  'Multipurpose Hall', 'Library', 'Amphitheatre', 'Sports Court',
];

const PROJECT_TYPES = [
  { value: 'Residential', label: 'Residential' },
  { value: 'Commercial', label: 'Commercial' },
  { value: 'Mixed', label: 'Mixed Use' },
];

const CONSTRUCTION_STATUSES = [
  { value: 'Pre-Launch', label: 'Pre-Launch' },
  { value: 'Under Construction', label: 'Under Construction' },
  { value: 'Nearing Completion', label: 'Nearing Completion' },
  { value: 'Ready to Move', label: 'Ready to Move' },
  { value: 'Completed', label: 'Completed' },
];

const CollapsibleSection = ({ title, icon, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="addproject__section">
      <div className="addproject__section-header" onClick={() => setOpen(o => !o)}>
        <h3 className="addproject__section-title">
          {icon}
          {title}
        </h3>
        <ChevronDown
          size={18}
          className={`addproject__section-chevron ${open ? 'addproject__section-chevron--open' : ''}`}
        />
      </div>
      {open && <div className="addproject__section-body">{children}</div>}
    </div>
  );
};

const AddProject = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [mediaFiles, setMediaFiles] = useState([]);

  const [form, setForm] = useState({
    name: '',
    developer: '',
    rera_number: '',
    project_type: '',
    construction_status: '',
    possession_date: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    latitude: '',
    longitude: '',
    total_towers: '',
    total_units: '',
    description: '',
    amenities: '',
  });

  useEffect(() => {
    if (isEditing) {
      (async () => {
        try {
          const res = await apiFetch(`projects/${id}`);
          if (res.success && res.data) {
            const p = res.data;
            setForm({
              name: p.name || '',
              developer: p.developer || '',
              rera_number: p.rera_number || '',
              project_type: p.project_type || '',
              construction_status: p.construction_status || '',
              possession_date: p.possession_date ? p.possession_date.slice(0, 10) : '',
              address: p.address || '',
              city: p.city || p.location || '',
              state: p.state || '',
              pincode: p.pincode || '',
              latitude: p.latitude || '',
              longitude: p.longitude || '',
              total_towers: p.total_towers ?? '',
              total_units: p.total_units ?? '',
              description: p.description || '',
              amenities: p.amenities || '',
            });
            if (Array.isArray(p.media) && p.media.length > 0) {
              setMediaFiles(p.media);
            }
          }
        } catch (err) {
          showToast('Failed to load project', 'error');
        }
      })();
    }
  }, [id, isEditing, showToast]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const toggleAmenity = (a) => {
    const current = form.amenities ? form.amenities.split(',').map(s => s.trim()).filter(Boolean) : [];
    const next = current.includes(a) ? current.filter(x => x !== a) : [...current, a];
    setForm(prev => ({ ...prev, amenities: next.join(', ') }));
  };

  const selectedAmenities = form.amenities ? form.amenities.split(',').map(s => s.trim()).filter(Boolean) : [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!form.name.trim()) newErrors.name = 'Project name is required';
    if (!form.developer.trim()) newErrors.developer = 'Developer is required';
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      showToast('Please fix the errors', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = { ...form };
      if (payload.total_towers) payload.total_towers = parseInt(payload.total_towers);
      if (payload.total_units) payload.total_units = parseInt(payload.total_units);
      if (payload.latitude) payload.latitude = parseFloat(payload.latitude);
      if (payload.longitude) payload.longitude = parseFloat(payload.longitude);

      const endpoint = isEditing ? `projects/${id}` : 'projects';
      const method = isEditing ? 'PUT' : 'POST';
      const res = await apiFetch(endpoint, { method, body: JSON.stringify(payload) });

      if (res.success) {
        const projectId = isEditing ? id : (res.data?.project_id || res.data?.id);

        // Upload new media files (File objects only)
        const newFiles = mediaFiles.filter(f => f instanceof File);
        if (newFiles.length > 0 && projectId) {
          const formData = new FormData();
          newFiles.forEach(file => formData.append('media', file));
          try {
            await apiFetch(`projects/${projectId}/media`, {
              method: 'POST',
              body: formData,
            });
          } catch (err) {
            console.error('Media upload error:', err);
          }
        }

        showToast(isEditing ? 'Project updated!' : 'Project created!');
        setTimeout(() => navigate('/projects'), 800);
      } else {
        showToast(res.message || 'Failed to save', 'error');
      }
    } catch (err) {
      showToast('Failed to save project', 'error');
    }
    setSaving(false);
  };

  return (
    <div className="addproject">
      <Header
        title={isEditing ? 'Edit Project' : 'Add Project'}
        subtitle={isEditing ? 'Update project details' : 'Create a new project'}
        actions={
          <Button variant="outline" icon={ArrowLeft} onClick={() => navigate('/projects')}>
            Back
          </Button>
        }
      />

      <div className="page">
        <form className="addproject__form" onSubmit={handleSubmit}>
          {/* Basic Info */}
          <CollapsibleSection title="Basic Information">
            <div className="addproject__section-grid">
              <div className="ab-field" style={{ gridColumn: '1/-1' }}>
                <label className="ab-field__label">Project Name <span className="ab-field__req">*</span></label>
                <input
                  className={`ab-field__input ${errors.name ? 'ab-field__input--error' : ''}`}
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="e.g. Green Valley Residences"
                />
                {errors.name && <span className="ab-field__error">{errors.name}</span>}
              </div>
              <div className="ab-field">
                <label className="ab-field__label">Developer <span className="ab-field__req">*</span></label>
                <input
                  className={`ab-field__input ${errors.developer ? 'ab-field__input--error' : ''}`}
                  name="developer"
                  value={form.developer}
                  onChange={handleChange}
                  placeholder="e.g. ABC Developers"
                />
                {errors.developer && <span className="ab-field__error">{errors.developer}</span>}
              </div>
              <div className="ab-field">
                <label className="ab-field__label">RERA Number</label>
                <input
                  className="ab-field__input"
                  name="rera_number"
                  value={form.rera_number}
                  onChange={handleChange}
                  placeholder="e.g. P52100012345"
                />
              </div>
              <div className="ab-field">
                <label className="ab-field__label">Project Type</label>
                <select className="ab-field__input ab-field__select" name="project_type" value={form.project_type} onChange={handleChange}>
                  <option value="">Select Type</option>
                  {PROJECT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="ab-field">
                <label className="ab-field__label">Construction Status</label>
                <select className="ab-field__input ab-field__select" name="construction_status" value={form.construction_status} onChange={handleChange}>
                  <option value="">Select Status</option>
                  {CONSTRUCTION_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className="ab-field">
                <label className="ab-field__label">Possession Date</label>
                <input
                  className="ab-field__input"
                  type="date"
                  name="possession_date"
                  value={form.possession_date}
                  onChange={handleChange}
                />
              </div>
            </div>
          </CollapsibleSection>

          {/* Location */}
          <CollapsibleSection title="Location">
            <div className="addproject__section-grid">
              <div className="ab-field" style={{ gridColumn: '1/-1' }}>
                <label className="ab-field__label">Address</label>
                <textarea
                  className="ab-field__input ab-field__textarea"
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  placeholder="Full project address"
                  rows={2}
                />
              </div>
              <div className="ab-field">
                <label className="ab-field__label">City</label>
                <input className="ab-field__input" name="city" value={form.city} onChange={handleChange} placeholder="e.g. Mumbai" />
              </div>
              <div className="ab-field">
                <label className="ab-field__label">State</label>
                <input className="ab-field__input" name="state" value={form.state} onChange={handleChange} placeholder="e.g. Maharashtra" />
              </div>
              <div className="ab-field">
                <label className="ab-field__label">Pincode</label>
                <input className="ab-field__input" name="pincode" value={form.pincode} onChange={handleChange} placeholder="e.g. 400001" />
              </div>
              <div className="ab-field">
                <label className="ab-field__label">Latitude</label>
                <input className="ab-field__input" type="number" step="any" name="latitude" value={form.latitude} onChange={handleChange} placeholder="e.g. 19.076" />
              </div>
              <div className="ab-field">
                <label className="ab-field__label">Longitude</label>
                <input className="ab-field__input" type="number" step="any" name="longitude" value={form.longitude} onChange={handleChange} placeholder="e.g. 72.877" />
              </div>
            </div>
          </CollapsibleSection>

          {/* Structure */}
          <CollapsibleSection title="Structure">
            <div className="addproject__section-grid">
              <div className="ab-field">
                <label className="ab-field__label">Total Towers</label>
                <input className="ab-field__input" type="number" min="0" name="total_towers" value={form.total_towers} onChange={handleChange} placeholder="0" />
              </div>
              <div className="ab-field">
                <label className="ab-field__label">Total Units</label>
                <input className="ab-field__input" type="number" min="0" name="total_units" value={form.total_units} onChange={handleChange} placeholder="0" />
              </div>
              <div className="ab-field" style={{ gridColumn: '1/-1' }}>
                <label className="ab-field__label">Description</label>
                <textarea
                  className="ab-field__input ab-field__textarea"
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  placeholder="Project description, highlights, key selling points..."
                  rows={4}
                />
              </div>
            </div>
          </CollapsibleSection>

          {/* Amenities */}
          <CollapsibleSection title="Amenities">
            <div className="addproject__amenities">
              {AMENITIES_LIST.map(a => (
                <button
                  key={a}
                  type="button"
                  className={`addproject__amenity-chip ${selectedAmenities.includes(a) ? 'addproject__amenity-chip--selected' : ''}`}
                  onClick={() => toggleAmenity(a)}
                >
                  {a}
                </button>
              ))}
            </div>
          </CollapsibleSection>

          {/* Media Upload */}
          <CollapsibleSection title="Media Upload">
            <MediaUploader
              files={mediaFiles}
              onFilesChange={setMediaFiles}
              accept="image/*,application/pdf,video/*"
              maxFiles={20}
              label="Upload project images, brochures, or videos"
            />
          </CollapsibleSection>

          {/* Actions */}
          <div className="addproject__actions">
            <Button variant="outline" type="button" onClick={() => navigate('/projects')}>
              Cancel
            </Button>
            <Button variant="gold" icon={Save} type="submit" disabled={saving}>
              {saving ? 'Saving...' : (isEditing ? 'Update Project' : 'Create Project')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddProject;
