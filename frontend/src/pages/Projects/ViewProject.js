import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiFetch } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import Header from '../../components/layout/Header';
import { Button, Modal, FormInput, FormSelect, Badge } from '../../components/common/Common';
import MediaUploader from '../../components/common/MediaUploader';
import {
  ArrowLeft, Edit2, Building2, Trash2, Plus, Search, Calendar,
  Star, X, Image as ImageIcon, Share2, Copy, Link, Eye, XCircle
} from 'lucide-react';
import './ViewProject.css';

const TABS = ['Overview', 'Media', 'Towers', 'Units', 'Timeline'];

const STATUS_CLASS_MAP = {
  'Pre-Launch': 'pre-launch',
  'Under Construction': 'under-construction',
  'Nearing Completion': 'nearing-completion',
  'Ready to Move': 'ready-to-move',
  'Completed': 'completed',
};

const UNIT_STATUS_MAP = {
  available: { label: 'Available', color: '#22c55e', bg: '#f0fdf4' },
  sold: { label: 'Sold', color: '#ef4444', bg: '#fef2f2' },
  rented: { label: 'Rented', color: '#3b82f6', bg: '#eff6ff' },
  reserved: { label: 'Reserved', color: '#f59e0b', bg: '#fffbeb' },
};

const ViewProject = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { showToast } = useToast();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Overview');

  // Media state
  const [media, setMedia] = useState([]);
  const [lightboxImg, setLightboxImg] = useState(null);
  const [newMediaFiles, setNewMediaFiles] = useState([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  // Towers state
  const [towers, setTowers] = useState([]);
  const [showTowerModal, setShowTowerModal] = useState(false);
  const [editTower, setEditTower] = useState(null);
  const [towerForm, setTowerForm] = useState({ name: '', total_floors: '', units_per_floor: '' });
  const [savingTower, setSavingTower] = useState(false);

  // Units state
  const [units, setUnits] = useState([]);
  const [unitSearch, setUnitSearch] = useState('');
  const [unitTowerFilter, setUnitTowerFilter] = useState('');
  const [unitStatusFilter, setUnitStatusFilter] = useState('');

  // Timeline state
  const [milestones, setMilestones] = useState([]);
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [editMilestone, setEditMilestone] = useState(null);
  const [milestoneForm, setMilestoneForm] = useState({ title: '', description: '', target_date: '', status: 'Upcoming' });
  const [savingMilestone, setSavingMilestone] = useState(false);

  // Share state
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareData, setShareData] = useState(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchProject = useCallback(async () => {
    try {
      const res = await apiFetch(`projects/${id}`);
      if (res.success && res.data) {
        setProject(res.data);
        if (Array.isArray(res.data.media)) setMedia(res.data.media);
        if (Array.isArray(res.data.towers)) setTowers(res.data.towers);
        if (Array.isArray(res.data.milestones)) setMilestones(res.data.milestones);
      }
    } catch (err) {
      console.error('Fetch project error:', err);
    }
    setLoading(false);
  }, [id]);

  const fetchTowers = useCallback(async () => {
    try {
      const res = await apiFetch(`projects/${id}/towers`);
      if (res.success) setTowers(Array.isArray(res.data) ? res.data : []);
    } catch (err) {}
  }, [id]);

  const fetchUnits = useCallback(async () => {
    try {
      const res = await apiFetch(`properties?project_id=${id}`);
      if (res.success) setUnits(Array.isArray(res.data) ? res.data : []);
    } catch (err) {}
  }, [id]);

  const fetchMilestones = useCallback(async () => {
    try {
      const res = await apiFetch(`projects/${id}/milestones`);
      if (res.success) setMilestones(Array.isArray(res.data) ? res.data : []);
    } catch (err) {}
  }, [id]);

  const fetchMedia = useCallback(async () => {
    try {
      const res = await apiFetch(`projects/${id}/media`);
      if (res.success) setMedia(Array.isArray(res.data) ? res.data : []);
    } catch (err) {}
  }, [id]);

  useEffect(() => { fetchProject(); }, [fetchProject]);

  useEffect(() => {
    if (activeTab === 'Towers') fetchTowers();
    if (activeTab === 'Units') fetchUnits();
    if (activeTab === 'Timeline') fetchMilestones();
    if (activeTab === 'Media') fetchMedia();
  }, [activeTab, fetchTowers, fetchUnits, fetchMilestones, fetchMedia]);

  // ── Tower CRUD ──
  const openAddTower = () => {
    setEditTower(null);
    setTowerForm({ name: '', total_floors: '', units_per_floor: '' });
    setShowTowerModal(true);
  };
  const openEditTower = (t) => {
    setEditTower(t);
    setTowerForm({ name: t.name || '', total_floors: t.total_floors ?? '', units_per_floor: t.units_per_floor ?? '' });
    setShowTowerModal(true);
  };
  const saveTower = async () => {
    if (!towerForm.name.trim()) { showToast('Tower name is required', 'error'); return; }
    setSavingTower(true);
    try {
      const payload = {
        ...towerForm,
        total_floors: towerForm.total_floors ? parseInt(towerForm.total_floors) : null,
        units_per_floor: towerForm.units_per_floor ? parseInt(towerForm.units_per_floor) : null,
      };
      const endpoint = editTower ? `projects/${id}/towers/${editTower.tower_id || editTower.id}` : `projects/${id}/towers`;
      const method = editTower ? 'PUT' : 'POST';
      const res = await apiFetch(endpoint, { method, body: JSON.stringify(payload) });
      if (res.success) {
        showToast(editTower ? 'Tower updated!' : 'Tower added!');
        setShowTowerModal(false);
        fetchTowers();
      } else {
        showToast(res.message || 'Failed', 'error');
      }
    } catch (err) {
      showToast('Failed to save tower', 'error');
    }
    setSavingTower(false);
  };
  const deleteTower = async (towerId) => {
    if (!window.confirm('Delete this tower?')) return;
    try {
      const res = await apiFetch(`projects/${id}/towers/${towerId}`, { method: 'DELETE' });
      if (res.success) { showToast('Tower deleted'); fetchTowers(); }
      else showToast(res.message || 'Failed', 'error');
    } catch (err) { showToast('Failed to delete', 'error'); }
  };

  // ── Media ──
  const handleMediaUpload = async () => {
    if (newMediaFiles.length === 0) return;
    setUploadingMedia(true);
    try {
      const formData = new FormData();
      newMediaFiles.forEach(f => formData.append('media', f));
      const res = await apiFetch(`projects/${id}/media`, { method: 'POST', body: formData });
      if (res.success) {
        showToast('Media uploaded!');
        setNewMediaFiles([]);
        fetchMedia();
      } else {
        showToast(res.message || 'Upload failed', 'error');
      }
    } catch (err) {
      showToast('Upload failed', 'error');
    }
    setUploadingMedia(false);
  };
  const deleteMedia = async (mediaId) => {
    try {
      const res = await apiFetch(`projects/${id}/media/${mediaId}`, { method: 'DELETE' });
      if (res.success) { showToast('Media deleted'); fetchMedia(); }
      else showToast(res.message || 'Failed', 'error');
    } catch (err) { showToast('Failed', 'error'); }
  };
  const setCover = async (mediaId) => {
    try {
      const res = await apiFetch(`projects/${id}/media/${mediaId}/cover`, { method: 'PATCH' });
      if (res.success) { showToast('Cover image set'); fetchMedia(); }
      else showToast(res.message || 'Failed', 'error');
    } catch (err) { showToast('Failed', 'error'); }
  };

  // ── Milestone CRUD ──
  const openAddMilestone = () => {
    setEditMilestone(null);
    setMilestoneForm({ title: '', description: '', target_date: '', status: 'Upcoming' });
    setShowMilestoneModal(true);
  };
  const openEditMilestone = (m) => {
    setEditMilestone(m);
    setMilestoneForm({
      title: m.title || '',
      description: m.description || '',
      target_date: m.target_date ? m.target_date.slice(0, 10) : '',
      status: m.status || 'Upcoming',
    });
    setShowMilestoneModal(true);
  };
  const saveMilestone = async () => {
    if (!milestoneForm.title.trim()) { showToast('Title is required', 'error'); return; }
    setSavingMilestone(true);
    try {
      const endpoint = editMilestone
        ? `projects/${id}/milestones/${editMilestone.milestone_id || editMilestone.id}`
        : `projects/${id}/milestones`;
      const method = editMilestone ? 'PUT' : 'POST';
      const res = await apiFetch(endpoint, { method, body: JSON.stringify(milestoneForm) });
      if (res.success) {
        showToast(editMilestone ? 'Milestone updated!' : 'Milestone added!');
        setShowMilestoneModal(false);
        fetchMilestones();
      } else {
        showToast(res.message || 'Failed', 'error');
      }
    } catch (err) {
      showToast('Failed to save', 'error');
    }
    setSavingMilestone(false);
  };
  const deleteMilestone = async (msId) => {
    if (!window.confirm('Delete this milestone?')) return;
    try {
      const res = await apiFetch(`projects/${id}/milestones/${msId}`, { method: 'DELETE' });
      if (res.success) { showToast('Milestone deleted'); fetchMilestones(); }
      else showToast(res.message || 'Failed', 'error');
    } catch (err) { showToast('Failed', 'error'); }
  };

  // ── Share ──
  const handleShare = async () => {
    setShareLoading(true);
    setShowShareModal(true);
    setCopied(false);
    try {
      const res = await apiFetch('share', {
        method: 'POST',
        body: JSON.stringify({ entity_type: 'project', entity_id: parseInt(id) }),
      });
      if (res.success && res.data) {
        setShareData(res.data);
      } else {
        showToast(res.message || 'Failed to create share link', 'error');
        setShowShareModal(false);
      }
    } catch (err) {
      showToast('Failed to create share link', 'error');
      setShowShareModal(false);
    }
    setShareLoading(false);
  };

  const copyShareLink = () => {
    if (shareData?.share_url) {
      navigator.clipboard.writeText(shareData.share_url);
      setCopied(true);
      showToast('Link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const deactivateShareLink = async () => {
    if (!shareData?.link_id) return;
    try {
      const res = await apiFetch(`share/${shareData.link_id}`, { method: 'DELETE' });
      if (res.success) {
        showToast('Share link deactivated');
        setShareData(null);
        setShowShareModal(false);
      } else {
        showToast(res.message || 'Failed', 'error');
      }
    } catch (err) {
      showToast('Failed to deactivate', 'error');
    }
  };

  // ── Filter units ──
  const filteredUnits = units.filter(u => {
    const q = unitSearch.toLowerCase();
    const matchSearch = !q || (u.title || '').toLowerCase().includes(q) || (u.unit_number || '').toLowerCase().includes(q);
    const matchTower = !unitTowerFilter || String(u.tower_id) === unitTowerFilter;
    const matchStatus = !unitStatusFilter || u.status === unitStatusFilter;
    return matchSearch && matchTower && matchStatus;
  });

  if (loading) return <div className="page" style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Loading...</div>;
  if (!project) return <div className="page" style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Project not found</div>;

  const amenities = project.amenities ? project.amenities.split(',').map(a => a.trim()).filter(Boolean) : [];
  const statusCls = STATUS_CLASS_MAP[project.construction_status] || '';

  return (
    <div className="vp">
      <Header
        title={project.name}
        subtitle={project.developer || 'Project Details'}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="outline" icon={ArrowLeft} onClick={() => navigate('/projects')}>Back</Button>
            <Button variant="outline" icon={Share2} onClick={handleShare}>Share</Button>
            <Button variant="outline" icon={Edit2} onClick={() => navigate(`/projects/edit/${id}`)}>Edit</Button>
          </div>
        }
      />

      <div className="page">
        {/* Banner */}
        <div className="vp__banner">
          <div className="vp__banner-left">
            <div className="vp__banner-icon"><Building2 size={24} /></div>
            <div>
              <h2 className="vp__banner-title">{project.name}</h2>
              <div className="vp__banner-badges">
                {project.project_type && (
                  <span className="vp__badge vp__badge--type">{project.project_type}</span>
                )}
                {project.construction_status && (
                  <span className={`vp__badge vp__badge--status-${statusCls}`}>{project.construction_status}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="vp__tabs">
          {TABS.map(tab => (
            <button
              key={tab}
              className={`vp__tab ${activeTab === tab ? 'vp__tab--active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* ──────────── Overview ──────────── */}
        {activeTab === 'Overview' && (
          <div className="vp__overview">
            <div>
              {/* Info Grid */}
              <div className="ab-section">
                <h3 className="ab-section__title">Project Information</h3>
                <div className="vp__info-grid">
                  {[
                    { label: 'Developer', value: project.developer || '-' },
                    { label: 'RERA Number', value: project.rera_number || '-' },
                    { label: 'Type', value: project.project_type || '-' },
                    { label: 'Status', value: project.construction_status || '-' },
                    { label: 'Possession Date', value: project.possession_date ? new Date(project.possession_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-' },
                    { label: 'Total Towers', value: project.total_towers ?? '-' },
                    { label: 'Total Units', value: project.total_units ?? '-' },
                  ].map((d, i) => (
                    <div className="vp__info-item" key={i}>
                      <span className="vp__info-label">{d.label}</span>
                      <span className="vp__info-value">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Location */}
              {(project.address || project.city || project.state) && (
                <div className="ab-section">
                  <h3 className="ab-section__title">Location</h3>
                  <div className="vp__info-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                    {project.address && (
                      <div className="vp__info-item" style={{ gridColumn: '1/-1' }}>
                        <span className="vp__info-label">Address</span>
                        <span className="vp__info-value">{project.address}</span>
                      </div>
                    )}
                    {project.city && (
                      <div className="vp__info-item">
                        <span className="vp__info-label">City</span>
                        <span className="vp__info-value">{project.city}</span>
                      </div>
                    )}
                    {project.state && (
                      <div className="vp__info-item">
                        <span className="vp__info-label">State</span>
                        <span className="vp__info-value">{project.state}</span>
                      </div>
                    )}
                    {project.pincode && (
                      <div className="vp__info-item">
                        <span className="vp__info-label">Pincode</span>
                        <span className="vp__info-value">{project.pincode}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Description */}
              {project.description && (
                <div className="ab-section">
                  <h3 className="ab-section__title">Description</h3>
                  <p className="vp__description-text">{project.description}</p>
                </div>
              )}
            </div>

            {/* Right sidebar - Amenities */}
            <div>
              {amenities.length > 0 && (
                <div className="ab-section ab-section--sticky">
                  <h3 className="ab-section__title">Amenities</h3>
                  <div className="vp__amenity-chips">
                    {amenities.map((a, i) => (
                      <span key={i} className="vp__amenity-chip">{a}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ──────────── Media ──────────── */}
        {activeTab === 'Media' && (
          <div>
            <div className="vp__media-toolbar">
              <h3 className="ab-section__title" style={{ margin: 0 }}>
                Project Media ({media.length})
              </h3>
            </div>

            {/* Upload section */}
            <div className="ab-section" style={{ marginBottom: 20 }}>
              <MediaUploader
                files={newMediaFiles}
                onFilesChange={setNewMediaFiles}
                accept="image/*,application/pdf,video/*"
                maxFiles={10}
                label="Upload new media"
              />
              {newMediaFiles.length > 0 && (
                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button variant="gold" icon={Plus} onClick={handleMediaUpload} disabled={uploadingMedia}>
                    {uploadingMedia ? 'Uploading...' : `Upload ${newMediaFiles.length} file(s)`}
                  </Button>
                </div>
              )}
            </div>

            {/* Gallery */}
            {media.length > 0 ? (
              <div className="vp__media-grid">
                {media.map((m, i) => {
                  const url = m.url || m.file_url || '';
                  const isImg = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(url) || (m.type || '').startsWith('image');
                  return (
                    <div className="vp__media-card" key={m.media_id || m.id || i} onClick={() => isImg && setLightboxImg(url)}>
                      {m.is_cover && <span className="vp__media-cover-badge">Cover</span>}
                      {isImg ? (
                        <img className="vp__media-img" src={url} alt={m.name || `Media ${i + 1}`} />
                      ) : (
                        <div style={{ width: '100%', height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--gray-50)', color: 'var(--gray-400)' }}>
                          <ImageIcon size={32} />
                        </div>
                      )}
                      <div className="vp__media-actions" onClick={e => e.stopPropagation()}>
                        <button
                          className="vp__media-action-btn vp__media-action-btn--cover"
                          title="Set as cover"
                          onClick={() => setCover(m.media_id || m.id)}
                        >
                          <Star size={12} />
                        </button>
                        <button
                          className="vp__media-action-btn vp__media-action-btn--delete"
                          title="Delete"
                          onClick={() => deleteMedia(m.media_id || m.id)}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="ab-section" style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 40 }}>
                No media uploaded yet
              </div>
            )}

            {/* Lightbox */}
            {lightboxImg && (
              <div className="vp__lightbox" onClick={() => setLightboxImg(null)}>
                <button className="vp__lightbox-close" onClick={() => setLightboxImg(null)}><X size={18} /></button>
                <img className="vp__lightbox-img" src={lightboxImg} alt="Preview" onClick={e => e.stopPropagation()} />
              </div>
            )}
          </div>
        )}

        {/* ──────────── Towers ──────────── */}
        {activeTab === 'Towers' && (
          <div>
            <div className="vp__towers-toolbar">
              <h3 className="ab-section__title" style={{ margin: 0 }}>
                Towers ({towers.length})
              </h3>
              <Button variant="primary" size="sm" icon={Plus} onClick={openAddTower}>
                Add Tower
              </Button>
            </div>

            {towers.length > 0 ? (
              <div className="vp__towers-grid">
                {towers.map(t => {
                  const tid = t.tower_id || t.id;
                  const unitCount = t.unit_count ?? (t.total_floors && t.units_per_floor ? t.total_floors * t.units_per_floor : '-');
                  return (
                    <div className="vp__tower-card" key={tid}>
                      <div className="vp__tower-header">
                        <span className="vp__tower-name">{t.name}</span>
                        <div className="vp__tower-actions">
                          <button className="vp__tower-action" onClick={() => openEditTower(t)} title="Edit">
                            <Edit2 size={13} />
                          </button>
                          <button className="vp__tower-action vp__tower-action--danger" onClick={() => deleteTower(tid)} title="Delete">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                      <div className="vp__tower-stats">
                        <div className="vp__tower-stat">
                          <span className="vp__tower-stat-label">Floors</span>
                          <span className="vp__tower-stat-value">{t.total_floors ?? '-'}</span>
                        </div>
                        <div className="vp__tower-stat">
                          <span className="vp__tower-stat-label">Units/Floor</span>
                          <span className="vp__tower-stat-value">{t.units_per_floor ?? '-'}</span>
                        </div>
                        <div className="vp__tower-stat">
                          <span className="vp__tower-stat-label">Total Units</span>
                          <span className="vp__tower-stat-value">{unitCount}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="ab-section" style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 40 }}>
                No towers added yet
              </div>
            )}

            {/* Tower Modal */}
            <Modal isOpen={showTowerModal} onClose={() => setShowTowerModal(false)} title={editTower ? 'Edit Tower' : 'Add Tower'} size="sm">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <FormInput
                  label="Tower Name *"
                  value={towerForm.name}
                  onChange={e => setTowerForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Tower A"
                />
                <div className="vp__modal-grid">
                  <FormInput
                    label="Total Floors"
                    type="number"
                    min="0"
                    value={towerForm.total_floors}
                    onChange={e => setTowerForm(p => ({ ...p, total_floors: e.target.value }))}
                    placeholder="0"
                  />
                  <FormInput
                    label="Units per Floor"
                    type="number"
                    min="0"
                    value={towerForm.units_per_floor}
                    onChange={e => setTowerForm(p => ({ ...p, units_per_floor: e.target.value }))}
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="modal__actions">
                <Button variant="outline" onClick={() => setShowTowerModal(false)}>Cancel</Button>
                <Button variant="gold" onClick={saveTower} disabled={savingTower}>
                  {savingTower ? 'Saving...' : (editTower ? 'Update' : 'Add Tower')}
                </Button>
              </div>
            </Modal>
          </div>
        )}

        {/* ──────────── Units ──────────── */}
        {activeTab === 'Units' && (
          <div>
            <div className="vp__units-toolbar">
              <div className="vp__units-search">
                <Search size={15} />
                <input placeholder="Search units..." value={unitSearch} onChange={e => setUnitSearch(e.target.value)} />
              </div>
              {towers.length > 0 && (
                <select className="vp__units-filter" value={unitTowerFilter} onChange={e => setUnitTowerFilter(e.target.value)}>
                  <option value="">All Towers</option>
                  {towers.map(t => (
                    <option key={t.tower_id || t.id} value={t.tower_id || t.id}>{t.name}</option>
                  ))}
                </select>
              )}
              <select className="vp__units-filter" value={unitStatusFilter} onChange={e => setUnitStatusFilter(e.target.value)}>
                <option value="">All Status</option>
                <option value="available">Available</option>
                <option value="sold">Sold</option>
                <option value="rented">Rented</option>
                <option value="reserved">Reserved</option>
              </select>
              <Button variant="primary" size="sm" icon={Plus} onClick={() => navigate(`/properties/add?project_id=${id}`)}>
                Add Property
              </Button>
            </div>

            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Unit No.</th>
                    <th>Type</th>
                    <th>Config</th>
                    <th>Area</th>
                    <th>Price</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUnits.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="table__empty">No properties found for this project</td>
                    </tr>
                  ) : (
                    filteredUnits.map(u => {
                      const st = UNIT_STATUS_MAP[u.status] || UNIT_STATUS_MAP.available;
                      return (
                        <tr key={u.property_id || u.id} className="table__row--clickable" onClick={() => navigate(`/properties/view/${u.property_id || u.id}`)}>
                          <td style={{ fontWeight: 600, color: 'var(--gray-800)' }}>{u.title || '-'}</td>
                          <td>{u.unit_number || '-'}</td>
                          <td>{u.property_type || '-'}</td>
                          <td>{u.configuration || '-'}</td>
                          <td>{u.area ? `${u.area} ${u.area_unit || 'sqft'}` : '-'}</td>
                          <td>{u.price ? `₹${Number(u.price).toLocaleString('en-IN')}` : '-'}</td>
                          <td>
                            <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, color: st.color, background: st.bg }}>
                              {st.label}
                            </span>
                          </td>
                          <td onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button className="vp__tower-action" onClick={() => navigate(`/properties/edit/${u.property_id || u.id}`)} title="Edit">
                                <Edit2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ──────────── Timeline ──────────── */}
        {activeTab === 'Timeline' && (
          <div>
            <div className="vp__timeline-toolbar">
              <h3 className="ab-section__title" style={{ margin: 0 }}>
                Project Timeline ({milestones.length})
              </h3>
              <Button variant="primary" size="sm" icon={Plus} onClick={openAddMilestone}>
                Add Milestone
              </Button>
            </div>

            {milestones.length > 0 ? (
              <div className="vp__timeline">
                {milestones.map(m => {
                  const msId = m.milestone_id || m.id;
                  const statusKey = (m.status || 'upcoming').toLowerCase().replace(/\s+/g, '-');
                  return (
                    <div className="vp__milestone" key={msId}>
                      <div className={`vp__milestone-dot vp__milestone-dot--${statusKey}`} />
                      <div className="vp__milestone-card">
                        <div className="vp__milestone-header">
                          <span className="vp__milestone-title">{m.title}</span>
                          <div className="vp__milestone-actions">
                            <button className="vp__tower-action" onClick={() => openEditMilestone(m)} title="Edit">
                              <Edit2 size={13} />
                            </button>
                            <button className="vp__tower-action vp__tower-action--danger" onClick={() => deleteMilestone(msId)} title="Delete">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                        {m.description && <p className="vp__milestone-desc">{m.description}</p>}
                        <div className="vp__milestone-meta">
                          {m.target_date && (
                            <span className="vp__milestone-date">
                              <Calendar size={11} />
                              {new Date(m.target_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                          )}
                          <span className={`vp__milestone-status vp__milestone-status--${statusKey}`}>
                            {m.status || 'Upcoming'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="ab-section" style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 40 }}>
                No milestones added yet
              </div>
            )}

            {/* Milestone Modal */}
            <Modal isOpen={showMilestoneModal} onClose={() => setShowMilestoneModal(false)} title={editMilestone ? 'Edit Milestone' : 'Add Milestone'} size="md">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <FormInput
                  label="Title *"
                  value={milestoneForm.title}
                  onChange={e => setMilestoneForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Foundation Complete"
                />
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-input"
                    value={milestoneForm.description}
                    onChange={e => setMilestoneForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="Milestone details..."
                    rows={3}
                    style={{ resize: 'vertical' }}
                  />
                </div>
                <div className="vp__modal-grid">
                  <FormInput
                    label="Target Date"
                    type="date"
                    value={milestoneForm.target_date}
                    onChange={e => setMilestoneForm(p => ({ ...p, target_date: e.target.value }))}
                  />
                  <FormSelect
                    label="Status"
                    value={milestoneForm.status}
                    onChange={e => setMilestoneForm(p => ({ ...p, status: e.target.value }))}
                    options={[
                      { value: 'Upcoming', label: 'Upcoming' },
                      { value: 'In Progress', label: 'In Progress' },
                      { value: 'Completed', label: 'Completed' },
                    ]}
                  />
                </div>
              </div>
              <div className="modal__actions">
                <Button variant="outline" onClick={() => setShowMilestoneModal(false)}>Cancel</Button>
                <Button variant="gold" onClick={saveMilestone} disabled={savingMilestone}>
                  {savingMilestone ? 'Saving...' : (editMilestone ? 'Update' : 'Add Milestone')}
                </Button>
              </div>
            </Modal>
          </div>
        )}
      </div>

      {/* Share Modal */}
      <Modal isOpen={showShareModal} onClose={() => setShowShareModal(false)} title="Share Project" size="sm">
        {shareLoading ? (
          <div style={{ textAlign: 'center', padding: 30, color: 'var(--gray-400)' }}>
            Generating share link...
          </div>
        ) : shareData ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Link size={16} style={{ color: 'var(--gray-400)', flexShrink: 0 }} />
              <input
                readOnly
                value={shareData.share_url}
                style={{
                  flex: 1, padding: '10px 12px', borderRadius: 8,
                  border: '1px solid var(--gray-200)', fontSize: 13,
                  background: 'var(--gray-50)', color: 'var(--gray-700)',
                  outline: 'none',
                }}
                onClick={e => e.target.select()}
              />
              <Button variant={copied ? 'primary' : 'outline'} icon={Copy} onClick={copyShareLink} style={{ flexShrink: 0 }}>
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--gray-50)', borderRadius: 8, border: '1px solid var(--gray-200)' }}>
              <Eye size={16} style={{ color: 'var(--gray-400)' }} />
              <span style={{ fontSize: 13, color: 'var(--gray-600)' }}>
                <strong style={{ color: 'var(--gray-800)' }}>{shareData.view_count || 0}</strong> views
              </span>
              <span style={{ fontSize: 11, color: 'var(--gray-400)', marginLeft: 'auto' }}>
                Created {new Date(shareData.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            </div>
            <button
              onClick={deactivateShareLink}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '8px 0', background: 'none', border: 'none',
                color: '#ef4444', fontSize: 12, fontWeight: 500,
                cursor: 'pointer', opacity: 0.8,
              }}
            >
              <XCircle size={14} /> Deactivate Link
            </button>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};

export default ViewProject;
