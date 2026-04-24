import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import Header from '../../components/layout/Header';
import { Button } from '../../components/common/Common';
import MediaUploader from '../../components/common/MediaUploader';
import { Save, ArrowLeft } from 'lucide-react';

const AMENITIES = ['Swimming Pool', 'Gym', 'Parking', 'Security', 'Garden', 'Clubhouse', 'Lift', 'Power Backup', 'CCTV', 'Play Area', 'Intercom', 'Fire Safety', 'Gas Pipeline', 'Rain Water Harvesting'];

const AddProperty = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEditing = !!id;
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [projects, setProjects] = useState([]);
  const [towers, setTowers] = useState([]);
  const [mediaFiles, setMediaFiles] = useState([]);

  const [form, setForm] = useState({
    title: '', description: '', property_type: '', configuration: '',
    location: '', address: '', price: '', price_unit: 'INR',
    area: '', area_unit: 'sqft', bedrooms: '', bathrooms: '',
    floor: '', total_floors: '', furnishing: '', facing: '',
    amenities: '', status: 'available', project_id: '',
    // New fields
    unit_number: '', tower_id: '',
    carpet_area: '', builtup_area: '', super_builtup_area: '',
    base_price: '',
    owner_type: '', owner_name: '', owner_contact: '',
    parking: '', balconies: '', rera_id: '',
  });

  // Auto-set project_id from query param
  useEffect(() => {
    const qProjectId = searchParams.get('project_id');
    if (qProjectId && !isEditing) {
      setForm(p => ({ ...p, project_id: qProjectId }));
    }
  }, [searchParams, isEditing]);

  // Fetch projects
  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch('projects');
        if (res.success) setProjects(Array.isArray(res.data) ? res.data : []);
      } catch (err) {}
    })();
  }, []);

  // Fetch towers when project changes
  useEffect(() => {
    if (form.project_id) {
      (async () => {
        try {
          const res = await apiFetch(`projects/${form.project_id}/towers`);
          if (res.success) setTowers(Array.isArray(res.data) ? res.data : []);
          else setTowers([]);
        } catch (err) { setTowers([]); }
      })();
    } else {
      setTowers([]);
      setForm(p => ({ ...p, tower_id: '' }));
    }
  }, [form.project_id]);

  // Fetch existing property for editing
  useEffect(() => {
    if (isEditing) {
      (async () => {
        try {
          const res = await apiFetch(`properties/${id}`);
          if (res.success && res.data) {
            const p = res.data;
            setForm({
              title: p.title || '', description: p.description || '',
              property_type: p.property_type || '', configuration: p.configuration || '',
              location: p.location || '', address: p.address || '',
              price: p.price || '', price_unit: p.price_unit || 'INR',
              area: p.area || '', area_unit: p.area_unit || 'sqft',
              bedrooms: p.bedrooms ?? '', bathrooms: p.bathrooms ?? '',
              floor: p.floor || '', total_floors: p.total_floors ?? '',
              furnishing: p.furnishing || '', facing: p.facing || '',
              amenities: p.amenities || '', status: p.status || 'available',
              project_id: p.project_id || '',
              unit_number: p.unit_number || '', tower_id: p.tower_id || '',
              carpet_area: p.carpet_area || '', builtup_area: p.builtup_area || '',
              super_builtup_area: p.super_builtup_area || '',
              base_price: p.base_price || '',
              owner_type: p.owner_type || '', owner_name: p.owner_name || '',
              owner_contact: p.owner_contact || '',
              parking: p.parking || '', balconies: p.balconies ?? '',
              rera_id: p.rera_id || '',
            });
            if (Array.isArray(p.media) && p.media.length > 0) {
              setMediaFiles(p.media);
            }
          }
        } catch (err) {}
      })();
    }
  }, [id, isEditing]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(p => ({ ...p, [name]: value }));
    if (errors[name]) setErrors(p => ({ ...p, [name]: '' }));
  };

  const pricePerSqft = useMemo(() => {
    const price = parseFloat(form.price);
    const carpet = parseFloat(form.carpet_area);
    if (price > 0 && carpet > 0) return Math.round(price / carpet);
    return '';
  }, [form.price, form.carpet_area]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!form.title.trim()) newErrors.title = 'Title is required';
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) { showToast('Please fix errors', 'error'); return; }

    setSaving(true);
    try {
      const payload = { ...form };
      if (payload.price) payload.price = parseFloat(payload.price);
      if (payload.area) payload.area = parseFloat(payload.area);
      if (payload.bedrooms) payload.bedrooms = parseInt(payload.bedrooms);
      if (payload.bathrooms) payload.bathrooms = parseInt(payload.bathrooms);
      if (payload.total_floors) payload.total_floors = parseInt(payload.total_floors);
      if (payload.carpet_area) payload.carpet_area = parseFloat(payload.carpet_area);
      if (payload.builtup_area) payload.builtup_area = parseFloat(payload.builtup_area);
      if (payload.super_builtup_area) payload.super_builtup_area = parseFloat(payload.super_builtup_area);
      if (payload.base_price) payload.base_price = parseFloat(payload.base_price);
      if (payload.balconies) payload.balconies = parseInt(payload.balconies);
      if (!payload.project_id) payload.project_id = null;
      if (!payload.tower_id) payload.tower_id = null;
      if (pricePerSqft) payload.price_per_sqft = pricePerSqft;

      const endpoint = isEditing ? `properties/${id}` : 'properties';
      const method = isEditing ? 'PUT' : 'POST';
      const res = await apiFetch(endpoint, { method, body: JSON.stringify(payload) });

      if (res.success) {
        const propertyId = isEditing ? id : (res.data?.property_id || res.data?.id);

        // Upload new media files
        const newFiles = mediaFiles.filter(f => f instanceof File);
        if (newFiles.length > 0 && propertyId) {
          const formData = new FormData();
          newFiles.forEach(file => formData.append('media', file));
          try {
            await apiFetch(`properties/${propertyId}/media`, {
              method: 'POST',
              body: formData,
            });
          } catch (err) {
            console.error('Media upload error:', err);
          }
        }

        showToast(isEditing ? 'Property updated!' : 'Property created!');
        setTimeout(() => navigate('/properties/all'), 1200);
      } else {
        showToast(res.message || 'Failed to save', 'error');
      }
    } catch (err) {
      showToast('Failed to save', 'error');
    }
    setSaving(false);
  };

  const toggleAmenity = (a) => {
    const current = form.amenities ? form.amenities.split(',').map(s => s.trim()).filter(Boolean) : [];
    const next = current.includes(a) ? current.filter(x => x !== a) : [...current, a];
    setForm(p => ({ ...p, amenities: next.join(', ') }));
  };

  const selectedAmenities = form.amenities ? form.amenities.split(',').map(s => s.trim()).filter(Boolean) : [];
  const showOwnerFields = form.owner_type && form.owner_type !== 'Developer';

  return (
    <div>
      <Header
        title={isEditing ? 'Edit Property' : 'Add Property'}
        subtitle={isEditing ? 'Update property details' : 'List a new property'}
        actions={<Button variant="outline" icon={ArrowLeft} onClick={() => navigate('/properties/all')}>Back</Button>}
      />
      <div className="page">
        <form className="ab-layout" onSubmit={handleSubmit} style={{ maxWidth: 1000 }}>
          <div className="ab-layout__left">
            {/* Basic Info */}
            <div className="ab-section">
              <h3 className="ab-section__title">Basic Information</h3>
              <div className="ab-section__grid">
                <div className="ab-field" style={{ gridColumn: '1/-1' }}>
                  <label className="ab-field__label">Title <span className="ab-field__req">*</span></label>
                  <input className={`ab-field__input ${errors.title ? 'ab-field__input--error' : ''}`} name="title" value={form.title} onChange={handleChange} placeholder="e.g. 2BHK Apartment in Green Valley" />
                  {errors.title && <span className="ab-field__error">{errors.title}</span>}
                </div>
                <div className="ab-field">
                  <label className="ab-field__label">Property Type</label>
                  <select className="ab-field__input ab-field__select" name="property_type" value={form.property_type} onChange={handleChange}>
                    <option value="">Select Type</option>
                    {['Apartment', 'Villa', 'Townhouse', 'Penthouse', 'Studio', 'Plot', 'Commercial Office', 'Commercial Shop', 'Warehouse'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="ab-field">
                  <label className="ab-field__label">Configuration</label>
                  <select className="ab-field__input ab-field__select" name="configuration" value={form.configuration} onChange={handleChange}>
                    <option value="">Select</option>
                    {['Studio', '1 BHK', '1.5 BHK', '2 BHK', '2.5 BHK', '3 BHK', '3.5 BHK', '4 BHK', '4+ BHK', 'Duplex'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="ab-field">
                  <label className="ab-field__label">Project</label>
                  <select className="ab-field__input ab-field__select" name="project_id" value={form.project_id} onChange={handleChange}>
                    <option value="">-- No Project --</option>
                    {projects.map(p => <option key={p.project_id} value={p.project_id}>{p.name}</option>)}
                  </select>
                </div>
                {towers.length > 0 && (
                  <div className="ab-field">
                    <label className="ab-field__label">Tower</label>
                    <select className="ab-field__input ab-field__select" name="tower_id" value={form.tower_id} onChange={handleChange}>
                      <option value="">-- Select Tower --</option>
                      {towers.map(t => <option key={t.tower_id || t.id} value={t.tower_id || t.id}>{t.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="ab-field">
                  <label className="ab-field__label">Unit Number</label>
                  <input className="ab-field__input" name="unit_number" value={form.unit_number} onChange={handleChange} placeholder="e.g. A-501" />
                </div>
                <div className="ab-field">
                  <label className="ab-field__label">Status</label>
                  <select className="ab-field__input ab-field__select" name="status" value={form.status} onChange={handleChange}>
                    <option value="available">Available</option>
                    <option value="sold">Sold</option>
                    <option value="rented">Rented</option>
                    <option value="reserved">Reserved</option>
                  </select>
                </div>
                <div className="ab-field">
                  <label className="ab-field__label">RERA ID</label>
                  <input className="ab-field__input" name="rera_id" value={form.rera_id} onChange={handleChange} placeholder="e.g. P52100012345" />
                </div>
              </div>
            </div>

            {/* Property Details */}
            <div className="ab-section">
              <h3 className="ab-section__title">Property Details</h3>
              <div className="ab-section__grid">
                <div className="ab-field">
                  <label className="ab-field__label">Bedrooms</label>
                  <input className="ab-field__input" type="number" name="bedrooms" value={form.bedrooms} onChange={handleChange} placeholder="0" min="0" />
                </div>
                <div className="ab-field">
                  <label className="ab-field__label">Bathrooms</label>
                  <input className="ab-field__input" type="number" name="bathrooms" value={form.bathrooms} onChange={handleChange} placeholder="0" min="0" />
                </div>
                <div className="ab-field">
                  <label className="ab-field__label">Balconies</label>
                  <input className="ab-field__input" type="number" name="balconies" value={form.balconies} onChange={handleChange} placeholder="0" min="0" />
                </div>
                <div className="ab-field">
                  <label className="ab-field__label">Parking</label>
                  <input className="ab-field__input" name="parking" value={form.parking} onChange={handleChange} placeholder="e.g. 1 Covered" />
                </div>
                <div className="ab-field">
                  <label className="ab-field__label">Area</label>
                  <input className="ab-field__input" type="number" name="area" value={form.area} onChange={handleChange} placeholder="0" min="0" />
                </div>
                <div className="ab-field">
                  <label className="ab-field__label">Area Unit</label>
                  <select className="ab-field__input ab-field__select" name="area_unit" value={form.area_unit} onChange={handleChange}>
                    <option value="sqft">Sq Ft</option>
                    <option value="sqm">Sq Mt</option>
                    <option value="sqyd">Sq Yd</option>
                  </select>
                </div>
                <div className="ab-field">
                  <label className="ab-field__label">Carpet Area (sqft)</label>
                  <input className="ab-field__input" type="number" name="carpet_area" value={form.carpet_area} onChange={handleChange} placeholder="0" min="0" />
                </div>
                <div className="ab-field">
                  <label className="ab-field__label">Built-up Area (sqft)</label>
                  <input className="ab-field__input" type="number" name="builtup_area" value={form.builtup_area} onChange={handleChange} placeholder="0" min="0" />
                </div>
                <div className="ab-field">
                  <label className="ab-field__label">Super Built-up Area (sqft)</label>
                  <input className="ab-field__input" type="number" name="super_builtup_area" value={form.super_builtup_area} onChange={handleChange} placeholder="0" min="0" />
                </div>
                <div className="ab-field">
                  <label className="ab-field__label">Floor</label>
                  <input className="ab-field__input" name="floor" value={form.floor} onChange={handleChange} placeholder="e.g. 5th" />
                </div>
                <div className="ab-field">
                  <label className="ab-field__label">Total Floors</label>
                  <input className="ab-field__input" type="number" name="total_floors" value={form.total_floors} onChange={handleChange} placeholder="0" min="0" />
                </div>
                <div className="ab-field">
                  <label className="ab-field__label">Furnishing</label>
                  <select className="ab-field__input ab-field__select" name="furnishing" value={form.furnishing} onChange={handleChange}>
                    <option value="">Select</option>
                    <option value="unfurnished">Unfurnished</option>
                    <option value="semi-furnished">Semi Furnished</option>
                    <option value="fully-furnished">Fully Furnished</option>
                  </select>
                </div>
                <div className="ab-field">
                  <label className="ab-field__label">Facing</label>
                  <input className="ab-field__input" name="facing" value={form.facing} onChange={handleChange} placeholder="e.g. North, East" />
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div className="ab-section">
              <h3 className="ab-section__title">Pricing</h3>
              <div className="ab-section__grid">
                <div className="ab-field">
                  <label className="ab-field__label">Price</label>
                  <input className="ab-field__input" type="number" name="price" value={form.price} onChange={handleChange} placeholder="0" min="0" />
                </div>
                <div className="ab-field">
                  <label className="ab-field__label">Base Price</label>
                  <input className="ab-field__input" type="number" name="base_price" value={form.base_price} onChange={handleChange} placeholder="0" min="0" />
                </div>
                <div className="ab-field">
                  <label className="ab-field__label">Currency</label>
                  <select className="ab-field__input ab-field__select" name="price_unit" value={form.price_unit} onChange={handleChange}>
                    <option value="INR">INR</option>
                    <option value="AED">AED</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
                <div className="ab-field">
                  <label className="ab-field__label">Price per Sqft (auto)</label>
                  <input className="ab-field__input" type="text" value={pricePerSqft ? `₹${pricePerSqft.toLocaleString('en-IN')}` : '-'} readOnly disabled style={{ background: 'var(--gray-50)', color: 'var(--gray-500)' }} />
                </div>
              </div>
            </div>

            {/* Ownership */}
            <div className="ab-section">
              <h3 className="ab-section__title">Ownership</h3>
              <div className="ab-section__grid">
                <div className="ab-field">
                  <label className="ab-field__label">Owner Type</label>
                  <select className="ab-field__input ab-field__select" name="owner_type" value={form.owner_type} onChange={handleChange}>
                    <option value="">Select</option>
                    <option value="Developer">Developer</option>
                    <option value="Resale">Resale</option>
                    <option value="Investor">Investor</option>
                    <option value="Broker">Broker</option>
                  </select>
                </div>
                {showOwnerFields && (
                  <>
                    <div className="ab-field">
                      <label className="ab-field__label">Owner Name</label>
                      <input className="ab-field__input" name="owner_name" value={form.owner_name} onChange={handleChange} placeholder="Owner name" />
                    </div>
                    <div className="ab-field">
                      <label className="ab-field__label">Owner Contact</label>
                      <input className="ab-field__input" name="owner_contact" value={form.owner_contact} onChange={handleChange} placeholder="Phone or email" />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Location */}
            <div className="ab-section">
              <h3 className="ab-section__title">Location</h3>
              <div className="ab-section__grid">
                <div className="ab-field">
                  <label className="ab-field__label">Location</label>
                  <input className="ab-field__input" name="location" value={form.location} onChange={handleChange} placeholder="e.g. Andheri West, Mumbai" />
                </div>
                <div className="ab-field" style={{ gridColumn: '1/-1' }}>
                  <label className="ab-field__label">Address</label>
                  <textarea className="ab-field__input ab-field__textarea" name="address" value={form.address} onChange={handleChange} placeholder="Full address" rows={2} />
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="ab-section">
              <h3 className="ab-section__title">Description</h3>
              <div className="ab-field">
                <textarea className="ab-field__input ab-field__textarea" name="description" value={form.description} onChange={handleChange} placeholder="Property description..." rows={4} />
              </div>
            </div>

            {/* Media Upload */}
            <div className="ab-section">
              <h3 className="ab-section__title">Media</h3>
              <MediaUploader
                files={mediaFiles}
                onFilesChange={setMediaFiles}
                accept="image/*,application/pdf,video/*"
                maxFiles={15}
                label="Upload property images, floor plans, or documents"
              />
            </div>

            {/* Actions */}
            <div className="ab-actions">
              <Button variant="outline" type="button" onClick={() => navigate('/properties/all')}>Cancel</Button>
              <Button variant="gold" icon={Save} type="submit" disabled={saving}>
                {saving ? 'Saving...' : (isEditing ? 'Update Property' : 'Add Property')}
              </Button>
            </div>
          </div>

          {/* Right Side - Amenities */}
          <div className="ab-layout__right">
            <div className="ab-section ab-section--sticky">
              <h3 className="ab-section__title">Amenities</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {AMENITIES.map(a => (
                  <label key={a} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--gray-600)', cursor: 'pointer', padding: '4px 0' }}>
                    <input type="checkbox" checked={selectedAmenities.includes(a)} onChange={() => toggleAmenity(a)} style={{ accentColor: 'var(--navy-700)' }} />
                    {a}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddProperty;
