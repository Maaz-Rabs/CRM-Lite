import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../utils/api';
import Header from '../../components/layout/Header';
import { Button, Modal } from '../../components/common/Common';
import {
  Plus, Search, Eye, Edit2, Trash2, MapPin, Bed, Bath, Maximize,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import './Properties.css';

const STATUS_MAP = {
  available: { label: 'Available', color: '#22c55e', bg: '#f0fdf4' },
  sold:      { label: 'Sold',      color: '#ef4444', bg: '#fef2f2' },
  rented:    { label: 'Rented',    color: '#3b82f6', bg: '#eff6ff' },
  reserved:  { label: 'Reserved',  color: '#f59e0b', bg: '#fffbeb' },
};

const Properties = () => {
  const navigate = useNavigate();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [stats, setStats] = useState({ available: 0, sold: 0, rented: 0, reserved: 0, total: 0 });
  const [showDelete, setShowDelete] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchProperties = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', page);
      params.append('limit', 20);
      if (search) params.append('search', search);
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const res = await apiFetch(`properties?${params}`);
      if (res.success) {
        setProperties(res.data?.properties || []);
        setPagination(res.data?.pagination || { total: 0, totalPages: 1 });
      }
    } catch (err) {
      console.error('Fetch properties error:', err);
    }
    setLoading(false);
  }, [page, search, statusFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await apiFetch('properties/stats');
      if (res.success) setStats(res.data || {});
    } catch (err) {}
  }, []);

  useEffect(() => { fetchProperties(); }, [fetchProperties]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await apiFetch(`properties/${deleteId}`, { method: 'DELETE' });
      if (res.success) { showToast('Property deleted'); fetchProperties(); fetchStats(); }
      else showToast(res.message || 'Failed', 'error');
    } catch (err) { showToast('Failed to delete', 'error'); }
    setShowDelete(false);
    setDeleteId(null);
  };

  const formatPrice = (price) => {
    if (!price) return '-';
    const n = Number(price);
    if (n >= 10000000) return '₹' + (n / 10000000).toFixed(2) + ' Cr';
    if (n >= 100000) return '₹' + (n / 100000).toFixed(2) + ' L';
    return '₹' + n.toLocaleString('en-IN');
  };

  return (
    <div>
      <Header
        title="Properties"
        subtitle={`${pagination.total} properties listed`}
        actions={<Button variant="gold" icon={Plus} onClick={() => navigate('/properties/add')}>Add Property</Button>}
      />
      <div className="page">
        {/* Status Cards */}
        <div className="prop-stats">
          {[
            { key: 'all', label: 'All', count: stats.total || 0, color: '#1a2035' },
            { key: 'available', label: 'Available', count: stats.available || 0, color: '#22c55e' },
            { key: 'sold', label: 'Sold', count: stats.sold || 0, color: '#ef4444' },
            { key: 'rented', label: 'Rented', count: stats.rented || 0, color: '#3b82f6' },
            { key: 'reserved', label: 'Reserved', count: stats.reserved || 0, color: '#f59e0b' },
          ].map(s => (
            <div
              key={s.key}
              className={`prop-stats__card ${statusFilter === s.key ? 'prop-stats__card--active' : ''}`}
              style={{ '--ps-color': s.color }}
              onClick={() => { setStatusFilter(s.key); setPage(1); }}
            >
              <span className="prop-stats__count" style={{ color: s.color }}>{s.count}</span>
              <span className="prop-stats__label">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="prop-toolbar">
          <div className="prop-search">
            <Search size={16} />
            <input placeholder="Search by title, location, type..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
        </div>

        {/* Table */}
        <div className="prop-table-wrap">
          <table className="prop-table">
            <thead>
              <tr>
                <th>Property</th>
                <th>Type</th>
                <th>Config</th>
                <th>Price</th>
                <th>Area</th>
                <th>Project</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="8" className="prop-table__empty">Loading...</td></tr>
              ) : properties.length === 0 ? (
                <tr><td colSpan="8" className="prop-table__empty">No properties found</td></tr>
              ) : properties.map(p => {
                const st = STATUS_MAP[p.status] || STATUS_MAP.available;
                return (
                  <tr key={p.prop_id} className="prop-table__row">
                    <td>
                      <div className="prop-table__title-cell">
                        <span className="prop-table__title">{p.title}</span>
                        {p.location && <span className="prop-table__location"><MapPin size={11} /> {p.location}</span>}
                      </div>
                    </td>
                    <td><span className="prop-table__type">{p.property_type || '-'}</span></td>
                    <td>
                      <div className="prop-table__config">
                        {p.bedrooms != null && <span><Bed size={12} /> {p.bedrooms}</span>}
                        {p.bathrooms != null && <span><Bath size={12} /> {p.bathrooms}</span>}
                        {p.configuration && <span>{p.configuration}</span>}
                      </div>
                    </td>
                    <td><span className="prop-table__price">{formatPrice(p.price)}</span></td>
                    <td><span className="prop-table__area">{p.area ? `${p.area} ${p.area_unit || 'sqft'}` : '-'}</span></td>
                    <td><span className="prop-table__project">{p.project_name || '-'}</span></td>
                    <td>
                      <span className="prop-status-badge" style={{ color: st.color, background: st.bg }}>{st.label}</span>
                    </td>
                    <td>
                      <div className="prop-table__actions">
                        <button className="prop-action-btn" title="View" onClick={() => navigate(`/properties/view/${p.prop_id}`)}><Eye size={15} /></button>
                        <button className="prop-action-btn" title="Edit" onClick={() => navigate(`/properties/edit/${p.prop_id}`)}><Edit2 size={15} /></button>
                        <button className="prop-action-btn prop-action-btn--danger" title="Delete" onClick={() => { setDeleteId(p.prop_id); setShowDelete(true); }}><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="prop-paging">
            <span>Page {page} of {pagination.totalPages} ({pagination.total} properties)</span>
            <div className="prop-paging__btns">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft size={16} /></button>
              <button disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </div>

      <Modal isOpen={showDelete} onClose={() => setShowDelete(false)} title="Delete Property" size="sm">
        <p style={{ color: 'var(--gray-600)', marginBottom: 20 }}>Are you sure you want to delete this property?</p>
        <div className="modal__actions">
          <Button variant="outline" onClick={() => setShowDelete(false)}>Cancel</Button>
          <Button variant="danger" icon={Trash2} onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>

      {toast && <div className={`broker-toast broker-toast--${toast.type}`}>{toast.message}</div>}
    </div>
  );
};

export default Properties;
