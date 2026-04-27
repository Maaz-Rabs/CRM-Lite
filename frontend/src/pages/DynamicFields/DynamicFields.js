import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetch } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import Header from '../../components/layout/Header';
import { Modal, Button } from '../../components/common/Common';
import {
  Plus, Edit2, Trash2, ChevronDown, ChevronLeft, ChevronRight,
  Globe, Tag, Flag, Building2, Briefcase, Home, LayoutGrid, Clock, Search, X
} from 'lucide-react';
import '../../components/leads/LeadTable.css';
import './DynamicFields.css';

const ROWS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

const FIELD_TYPES = [
  { key: 'lead_sources', label: 'Lead Sources', icon: Globe, color: '#4285F4', endpoint: 'dynamic-fields/lead-sources', nameField: 'name', idField: 'src_id', hasColor: true, hasIcon: true },
  { key: 'lead_statuses', label: 'Lead Statuses', icon: Tag, color: '#22c55e', endpoint: 'dynamic-fields/lead-statuses', nameField: 'name', idField: 'ls_id', hasColor: true },
  { key: 'lead_priorities', label: 'Lead Priorities', icon: Flag, color: '#ef4444', endpoint: 'dynamic-fields/lead-priorities', nameField: 'name', idField: 'lp_id', hasColor: true },
  { key: 'projects', label: 'Projects', icon: Building2, color: '#8b5cf6', endpoint: 'dynamic-fields/projects', nameField: 'name', idField: 'project_id', extraFields: ['developer', 'location'] },
  { key: 'service_types', label: 'Service Types', icon: Briefcase, color: '#f59e0b', endpoint: 'dynamic-fields/service-types', nameField: 'name', idField: 'st_id' },
  { key: 'property_types', label: 'Property Types', icon: Home, color: '#06b6d4', endpoint: 'dynamic-fields/property-types', nameField: 'name', idField: 'pt_id' },
  { key: 'property_configurations', label: 'Configurations', icon: LayoutGrid, color: '#ec4899', endpoint: 'dynamic-fields/configurations', nameField: 'name', idField: 'pc_id' },
  // Color is intentionally NOT exposed for attendance policies — it isn't shown anywhere user-facing
  { key: 'attendance_policies', label: 'Attendance', icon: Clock, color: '#14b8a6', endpoint: 'dynamic-fields/attendance-policies', nameField: 'title', idField: 'ap_id', extraFields: ['type', 'rule'] },
];

// Attendance policy enum + helpers — kept in sync with backend VALID_ATTENDANCE_TYPES
const ATTENDANCE_TYPE_OPTIONS = [
  { value: 'full_day', label: 'Full Day', requires: 'hours', hint: 'Day is "Present" once worked hours reach the threshold.' },
  { value: 'half_day', label: 'Half Day', requires: 'hours', hint: 'Day is "Half Day" between this and the full-day threshold.' },
  { value: 'late_mark', label: 'Late Mark', requires: 'time', hint: 'First punch-in after this time flags the day as late.' },
  { value: 'intime', label: 'In-time', requires: 'time', hint: 'Used as the late cutoff if no Late Mark policy is active. First punch-in after this time will be flagged late.' },
  { value: 'week_off', label: 'Week Off', requires: 'days', hint: 'Selected weekdays are treated as days off.' },
];
const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const getAttendanceRequires = (type) =>
  ATTENDANCE_TYPE_OPTIONS.find(o => o.value === type)?.requires || null;

const DynamicFields = () => {
  const [selectedType, setSelectedType] = useState(FIELD_TYPES[0]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [formData, setFormData] = useState({ name: '', color: '#808080', icon: '', developer: '', location: '', type: '', threshold_hours: '', threshold_time: '', week_offs: '' });
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(selectedType.endpoint);
      if (res.success) {
        const data = res.data;
        setItems(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Fetch error:', err);
    }
    setLoading(false);
  }, [selectedType]);

  useEffect(() => { fetchItems(); }, [fetchItems]);
  useEffect(() => { setSearchQuery(''); setPage(1); }, [selectedType]);
  useEffect(() => { setPage(1); }, [searchQuery]);

  const filteredItems = items.filter(item => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    const name = String(item[selectedType.nameField] || '').toLowerCase();
    if (name.includes(q)) return true;
    if (selectedType.extraFields) {
      return selectedType.extraFields.some(f => {
        // `rule` is a virtual column for attendance — search the underlying fields instead
        if (f === 'rule') {
          return ['threshold_hours', 'threshold_time', 'week_offs', 'type']
            .some(k => String(item[k] || '').toLowerCase().includes(q));
        }
        return String(item[f] || '').toLowerCase().includes(q);
      });
    }
    return false;
  });

  const totalItems = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / rowsPerPage));
  const currentPage = Math.min(page, totalPages);
  const pagedItems = filteredItems.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const pageNums = useMemo(() => {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
      .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
      .reduce((acc, p, idx, arr) => {
        if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
        acc.push(p);
        return acc;
      }, []);
  }, [totalPages, currentPage]);

  const goToPage = (p) => {
    if (p < 1 || p > totalPages) return;
    setPage(p);
  };

  const openAdd = () => {
    setEditItem(null);
    setFormData({ name: '', color: '#808080', icon: '', developer: '', location: '', type: '', threshold_hours: '', threshold_time: '', week_offs: '' });
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditItem(item);
    setFormData({
      name: item[selectedType.nameField] || '',
      color: item.color || '#808080',
      icon: item.icon || '',
      developer: item.developer || '',
      location: item.location || '',
      type: item.type || '',
      threshold_hours: item.threshold_hours ?? '',
      // MySQL TIME comes back as 'HH:MM:SS' — slice to HH:MM for <input type="time">
      threshold_time: item.threshold_time ? String(item.threshold_time).slice(0, 5) : '',
      week_offs: item.week_offs || '',
    });
    setShowModal(true);
  };

  const toggleWeekDay = (dayIdx) => {
    setFormData(prev => {
      const days = (prev.week_offs || '').split(',').filter(Boolean);
      const key = String(dayIdx);
      const next = days.includes(key)
        ? days.filter(d => d !== key)
        : [...days, key].sort((a, b) => Number(a) - Number(b));
      return { ...prev, week_offs: next.join(',') };
    });
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      showToast('Name is required', 'error');
      return;
    }
    setSaving(true);
    try {
      let payload = { [selectedType.nameField]: formData.name.trim() };

      if (selectedType.key === 'attendance_policies') {
        // Type-aware payload — only persist fields that the chosen type uses,
        // and clear the others so a switched type doesn't leave stale values.
        if (!formData.type) { showToast('Type is required', 'error'); setSaving(false); return; }
        const requires = getAttendanceRequires(formData.type);

        if (requires === 'hours') {
          if (formData.threshold_hours === '' || isNaN(Number(formData.threshold_hours))) {
            showToast('Threshold hours is required', 'error'); setSaving(false); return;
          }
        }
        if (requires === 'time' && !formData.threshold_time) {
          showToast('Threshold time is required', 'error'); setSaving(false); return;
        }
        if (requires === 'days' && !formData.week_offs) {
          showToast('Pick at least one week-off day', 'error'); setSaving(false); return;
        }

        payload.type = formData.type;
        payload.threshold_hours = requires === 'hours' ? Number(formData.threshold_hours) : null;
        payload.threshold_time = requires === 'time' ? formData.threshold_time : null;
        payload.week_offs = requires === 'days' ? formData.week_offs : null;
      } else {
        if (selectedType.hasColor) payload.color = formData.color;
        if (selectedType.hasIcon) payload.icon = formData.icon;
        if (selectedType.extraFields) {
          selectedType.extraFields.forEach(f => { if (formData[f]) payload[f] = formData[f]; });
        }
      }

      const endpoint = editItem
        ? `${selectedType.endpoint}/${editItem[selectedType.idField]}`
        : selectedType.endpoint;
      const method = editItem ? 'PUT' : 'POST';

      const res = await apiFetch(endpoint, { method, body: JSON.stringify(payload) });
      if (res.success) {
        showToast(editItem ? 'Updated successfully' : 'Added successfully');
        setShowModal(false);
        fetchItems();
      } else {
        showToast(res.message || 'Failed to save', 'error');
      }
    } catch (err) {
      showToast('Failed to save', 'error');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    try {
      const res = await apiFetch(`${selectedType.endpoint}/${deleteItem[selectedType.idField]}`, { method: 'DELETE' });
      if (res.success) {
        showToast('Deleted successfully');
        fetchItems();
      } else {
        showToast(res.message || 'Failed to delete', 'error');
      }
    } catch (err) {
      showToast('Failed to delete', 'error');
    }
    setShowDeleteModal(false);
    setDeleteItem(null);
  };

  const handleToggle = async (item) => {
    try {
      const res = await apiFetch(`${selectedType.endpoint}/${item[selectedType.idField]}/toggle`, { method: 'PATCH' });
      if (res.success) {
        fetchItems();
      }
    } catch (err) {
      showToast('Failed to toggle', 'error');
    }
  };

  return (
    <div>
      <Header title="Dynamic Fields" subtitle="Manage all dropdown options in one place" />
      <div className="page">
      <div className="df-layout">
        {/* Left: Category Nav */}
        <aside className="df-nav">
          {FIELD_TYPES.map(ft => {
            const Icon = ft.icon;
            const isActive = ft.key === selectedType.key;
            const count = isActive ? items.length : null;
            return (
              <button
                key={ft.key}
                className={`df-nav-item ${isActive ? 'df-nav-item--active' : ''}`}
                style={{ '--df-accent': ft.color }}
                onClick={() => setSelectedType(ft)}
              >
                <span className="df-nav-item__icon" style={{ background: ft.color + '18', color: ft.color }}>
                  <Icon size={20} />
                </span>
                <span className="df-nav-item__label">{ft.label}</span>
                {count !== null && <span className="df-nav-item__count">{count}</span>}
              </button>
            );
          })}
        </aside>

        {/* Right: Content */}
        <section className="df-content">
        {/* Active Section Header */}
        <div className="df-active-header" style={{ '--df-accent': selectedType.color }}>
          <div className="df-active-header__accent" />
          <div className="df-active-header__left">
            <div className="df-active-header__icon" style={{ background: selectedType.color + '18', color: selectedType.color }}>
              {React.createElement(selectedType.icon, { size: 20 })}
            </div>
            <div>
              <h3 className="df-active-header__title">{selectedType.label}</h3>
              <span className="df-active-header__badge">{items.length} {items.length === 1 ? 'item' : 'items'}</span>
            </div>
          </div>
          <div className="df-active-header__right">
            <div className="df-search">
              <Search size={15} />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${selectedType.label.toLowerCase()}...`}
                className="df-search__input"
              />
              {searchQuery && (
                <button className="df-search__clear" onClick={() => setSearchQuery('')} title="Clear">
                  <X size={13} />
                </button>
              )}
            </div>
            <Button variant="gold" icon={Plus} onClick={openAdd}>Add New</Button>
          </div>
        </div>

        {/* Table */}
        <div className="df-table-wrap" style={{ '--df-accent': selectedType.color }}>
          <table className="df-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                {selectedType.hasColor && <th style={{ width: 50 }}>Color</th>}
                <th>Name</th>
                {selectedType.extraFields?.map(f => {
                  const label = f === 'rule' ? 'Rule' : f.replace(/_/g, ' ');
                  return <th key={f} style={{ textTransform: 'capitalize' }}>{label}</th>;
                })}
                <th style={{ width: 70 }}>Active</th>
                <th style={{ width: 100 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="10" className="df-table__empty">
                  <div className="df-empty">
                    <div className="df-empty__spinner" />
                    <span>Loading {selectedType.label.toLowerCase()}...</span>
                  </div>
                </td></tr>
              ) : filteredItems.length === 0 ? (
                <tr><td colSpan="10" className="df-table__empty">
                  <div className="df-empty">
                    <div className="df-empty__icon" style={{ background: selectedType.color + '15', color: selectedType.color }}>
                      {React.createElement(selectedType.icon, { size: 26 })}
                    </div>
                    {items.length === 0 ? (
                      <>
                        <p className="df-empty__title">No {selectedType.label.toLowerCase()} yet</p>
                        <p className="df-empty__sub">Click "Add New" to create your first one.</p>
                      </>
                    ) : (
                      <>
                        <p className="df-empty__title">No matches for "{searchQuery}"</p>
                        <p className="df-empty__sub">Try a different search term.</p>
                      </>
                    )}
                  </div>
                </td></tr>
              ) : pagedItems.map((item, idx) => {
                const isActive = item.is_active !== 0;
                const rowColor = selectedType.hasColor ? (item.color || '#808080') : null;
                const rowNum = (currentPage - 1) * rowsPerPage + idx + 1;
                return (
                <tr
                  key={item[selectedType.idField]}
                  className={'df-table__row' + (isActive ? '' : ' df-table__row--inactive')}
                  style={rowColor ? { '--row-color': rowColor } : undefined}
                >
                  <td className="df-table__num"><span className="df-num-pill">{rowNum}</span></td>
                  {selectedType.hasColor && (
                    <td>
                      <div className="df-color-chip">
                        <span className="df-color-chip__swatch" style={{ background: rowColor }} />
                        <span className="df-color-chip__hex">{(rowColor || '').toUpperCase()}</span>
                      </div>
                    </td>
                  )}
                  <td>
                    {rowColor ? (
                      <span className="df-name-badge" style={{
                        '--badge-color': rowColor,
                        color: rowColor,
                        background: rowColor + '14',
                        borderLeft: `3px solid ${rowColor}`,
                      }}>
                        {item[selectedType.nameField]}
                      </span>
                    ) : (
                      <span className="df-table__name">{item[selectedType.nameField]}</span>
                    )}
                  </td>
                  {selectedType.extraFields?.map(f => {
                    // Virtual `rule` column for attendance — renders the relevant
                    // threshold/days based on the policy type so each row stays meaningful.
                    if (f === 'rule' && selectedType.key === 'attendance_policies') {
                      const t = item.type;
                      const requires = getAttendanceRequires(t);
                      if (requires === 'hours' && item.threshold_hours != null && item.threshold_hours !== '') {
                        return <td key={f} className="df-table__extra df-table__extra--num">{item.threshold_hours}<span className="df-unit">h</span></td>;
                      }
                      if (requires === 'time' && item.threshold_time) {
                        return <td key={f} className="df-table__extra">{String(item.threshold_time).slice(0, 5)}</td>;
                      }
                      if (requires === 'days' && item.week_offs) {
                        const labels = String(item.week_offs)
                          .split(',')
                          .map(d => WEEK_DAYS[parseInt(d.trim(), 10)])
                          .filter(Boolean)
                          .join(', ');
                        return <td key={f} className="df-table__extra">{labels || '—'}</td>;
                      }
                      return <td key={f} className="df-table__extra df-table__extra--muted">—</td>;
                    }

                    const val = item[f];
                    if (val === null || val === undefined || val === '') {
                      return <td key={f} className="df-table__extra df-table__extra--muted">—</td>;
                    }
                    // Attendance policy `type` — plain text (no chip)
                    if (f === 'type') {
                      return <td key={f} className="df-table__extra">{String(val).replace(/_/g, ' ')}</td>;
                    }
                    // Render `threshold_hours` with an h suffix
                    if (f === 'threshold_hours') {
                      return <td key={f} className="df-table__extra df-table__extra--num">{val}<span className="df-unit">h</span></td>;
                    }
                    return <td key={f} className="df-table__extra">{val}</td>;
                  })}
                  <td>
                    <button
                      className={'df-switch' + (isActive ? ' df-switch--on' : '')}
                      onClick={() => handleToggle(item)}
                      title={isActive ? 'Active — click to disable' : 'Inactive — click to enable'}
                      aria-pressed={isActive}
                    >
                      <span className="df-switch__thumb" />
                    </button>
                  </td>
                  <td>
                    <div className="df-table__actions">
                      <button className="df-action-btn" title="Edit" onClick={() => openEdit(item)}><Edit2 size={14} /></button>
                      <button className="df-action-btn df-action-btn--danger" title="Delete" onClick={() => { setDeleteItem(item); setShowDeleteModal(true); }}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination */}
          {totalItems > 0 && (
            <div className="pagination df-pagination" style={{ '--df-accent': selectedType.color }}>
              <div className="pagination__info">
                Showing <strong>{Math.min((currentPage - 1) * rowsPerPage + 1, totalItems)}</strong>–
                <strong>{Math.min(currentPage * rowsPerPage, totalItems)}</strong> of{' '}
                <strong>{totalItems}</strong>
              </div>
              <div className="pagination__controls">
                <select
                  className="pagination__per-page"
                  value={rowsPerPage}
                  onChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(1); }}
                >
                  {ROWS_PER_PAGE_OPTIONS.map(n => <option key={n} value={n}>{n} / page</option>)}
                </select>
                <button className="pagination__btn" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}>
                  <ChevronLeft size={15} />
                </button>
                {pageNums.map((p, i) =>
                  p === '...'
                    ? <span key={'dots' + i} className="pagination__dots">...</span>
                    : <button
                        key={p}
                        className={'pagination__btn pagination__btn--num' + (currentPage === p ? ' pagination__btn--active' : '')}
                        onClick={() => goToPage(p)}
                      >{p}</button>
                )}
                <button className="pagination__btn" onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= totalPages}>
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}
        </div>
        </section>
      </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal isOpen={showModal} onClose={() => { if (!saving) setShowModal(false); }} title={editItem ? `Edit ${selectedType.label.replace(/s$/, '')}` : `Add ${selectedType.label.replace(/s$/, '')}`} size="sm">
        <div className="df-form">
          <div className="df-form__field">
            <label>Name *</label>
            <input value={formData.name} onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))} placeholder={`Enter ${selectedType.label.replace(/s$/, '').toLowerCase()} name`} />
          </div>
          {selectedType.hasColor && (
            <div className="df-form__field">
              <label>Color</label>
              <div className="df-form__color-row">
                <input type="color" value={formData.color} onChange={(e) => setFormData(p => ({ ...p, color: e.target.value }))} className="df-form__color-input" />
                <input value={formData.color} onChange={(e) => setFormData(p => ({ ...p, color: e.target.value }))} placeholder="#808080" className="df-form__color-text" />
              </div>
            </div>
          )}
          {selectedType.hasIcon && (
            <div className="df-form__field">
              <label>Icon</label>
              <input value={formData.icon} onChange={(e) => setFormData(p => ({ ...p, icon: e.target.value }))} placeholder="e.g. globe, user, building" />
            </div>
          )}
          {selectedType.key === 'attendance_policies' ? (
            <>
              <div className="df-form__field">
                <label>Type *</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData(p => ({ ...p, type: e.target.value }))}
                >
                  <option value="">Select type</option>
                  {ATTENDANCE_TYPE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                {formData.type && (
                  <small className="df-form__hint">
                    {ATTENDANCE_TYPE_OPTIONS.find(o => o.value === formData.type)?.hint}
                  </small>
                )}
              </div>

              {(formData.type === 'full_day' || formData.type === 'half_day') && (
                <div className="df-form__field">
                  <label>Threshold Hours *</label>
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    max="24"
                    value={formData.threshold_hours}
                    onChange={(e) => setFormData(p => ({ ...p, threshold_hours: e.target.value }))}
                    placeholder="e.g. 9"
                  />
                </div>
              )}

              {(formData.type === 'late_mark' || formData.type === 'intime') && (
                <div className="df-form__field">
                  <label>Threshold Time *</label>
                  <input
                    type="time"
                    value={formData.threshold_time}
                    onChange={(e) => setFormData(p => ({ ...p, threshold_time: e.target.value }))}
                  />
                </div>
              )}

              {formData.type === 'week_off' && (
                <div className="df-form__field">
                  <label>Week-off Days *</label>
                  <div className="df-week-grid">
                    {WEEK_DAYS.map((d, i) => {
                      const selected = (formData.week_offs || '')
                        .split(',')
                        .map(s => s.trim())
                        .includes(String(i));
                      return (
                        <button
                          type="button"
                          key={d}
                          className={'df-week-pill' + (selected ? ' df-week-pill--on' : '')}
                          onClick={() => toggleWeekDay(i)}
                          aria-pressed={selected}
                          aria-label={`${d}${selected ? ' (selected)' : ''}`}
                        >
                          {d}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            selectedType.extraFields?.map(f => (
              <div className="df-form__field" key={f}>
                <label style={{ textTransform: 'capitalize' }}>{f.replace(/_/g, ' ')}</label>
                <input value={formData[f] || ''} onChange={(e) => setFormData(p => ({ ...p, [f]: e.target.value }))} placeholder={`Enter ${f.replace(/_/g, ' ')}`} />
              </div>
            ))
          )}
          <div className="modal__actions">
            <Button variant="outline" onClick={() => setShowModal(false)} disabled={saving}>Cancel</Button>
            <Button variant="gold" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : (editItem ? 'Update' : 'Add')}</Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete Item" size="sm">
        <p style={{ color: 'var(--gray-600)', marginBottom: 20 }}>
          Are you sure you want to delete <strong>{deleteItem?.[selectedType.nameField]}</strong>? This may affect existing data.
        </p>
        <div className="modal__actions">
          <Button variant="outline" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
          <Button variant="danger" icon={Trash2} onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
};

export default DynamicFields;
