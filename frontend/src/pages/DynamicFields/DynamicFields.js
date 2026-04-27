import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetch } from '../../utils/api';
import Header from '../../components/layout/Header';
import { Modal, Button } from '../../components/common/Common';
import {
  Plus, Edit2, Trash2, ChevronLeft, ChevronRight,
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
  { key: 'attendance_policies', label: 'Attendance', icon: Clock, color: '#14b8a6', endpoint: 'dynamic-fields/attendance-policies', nameField: 'title', idField: 'ap_id', extraFields: ['type', 'threshold_hours'] },
];

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
  const [formData, setFormData] = useState({ name: '', color: '#808080', icon: '', developer: '', location: '', type: '', threshold_hours: '' });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

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
      return selectedType.extraFields.some(f =>
        String(item[f] || '').toLowerCase().includes(q)
      );
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
    setFormData({ name: '', color: '#808080', icon: '', developer: '', location: '', type: '', threshold_hours: '' });
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
      threshold_hours: item.threshold_hours || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      showToast('Name is required', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = { [selectedType.nameField]: formData.name.trim() };
      if (selectedType.hasColor) payload.color = formData.color;
      if (selectedType.hasIcon) payload.icon = formData.icon;
      if (selectedType.extraFields) {
        selectedType.extraFields.forEach(f => { if (formData[f]) payload[f] = formData[f]; });
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
                {selectedType.extraFields?.map(f => <th key={f} style={{ textTransform: 'capitalize' }}>{f.replace(/_/g, ' ')}</th>)}
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
                    const val = item[f];
                    if (val === null || val === undefined || val === '') {
                      return <td key={f} className="df-table__extra df-table__extra--muted">—</td>;
                    }
                    // Render `type` columns (e.g. attendance policy type) as a chip
                    if (f === 'type') {
                      return (
                        <td key={f}>
                          <span className="df-chip">{String(val).replace(/_/g, ' ')}</span>
                        </td>
                      );
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
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editItem ? `Edit ${selectedType.label.replace(/s$/, '')}` : `Add ${selectedType.label.replace(/s$/, '')}`} size="sm">
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
          {selectedType.extraFields?.map(f => (
            <div className="df-form__field" key={f}>
              <label style={{ textTransform: 'capitalize' }}>{f.replace(/_/g, ' ')}</label>
              <input value={formData[f] || ''} onChange={(e) => setFormData(p => ({ ...p, [f]: e.target.value }))} placeholder={`Enter ${f.replace(/_/g, ' ')}`} />
            </div>
          ))}
          <div className="modal__actions">
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
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

      {toast && <div className={`broker-toast broker-toast--${toast.type}`}>{toast.message}</div>}
    </div>
  );
};

export default DynamicFields;
