import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../utils/api';
import Header from '../../components/layout/Header';
import { Button, Modal } from '../../components/common/Common';
import { Plus, Search, Edit2, Trash2, Download, Users } from 'lucide-react';
import './AllCandidates.css';

const AllCandidates = () => {
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [toast, setToast] = useState(null);
  const limit = 20;

  // Dynamic field maps for display names
  const [sourceMap, setSourceMap] = useState({});
  const [positionMap, setPositionMap] = useState({});
  const [statusMap, setStatusMap] = useState({});

  const showToast = (msg, type = 'success') => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Fetch dynamic fields for mapping IDs to names
  useEffect(() => {
    const fetchFieldMap = async (type, setter) => {
      try {
        const res = await apiFetch(`dynamic-fields/${type}`);
        if (res.success && res.data) {
          const items = Array.isArray(res.data) ? res.data : res.data.items || [];
          const map = {};
          items.forEach((item) => {
            const id = item.id || item.df_id;
            map[id] = item.name || item.label || item.value || '';
          });
          setter(map);
        }
      } catch (err) {
        console.error(`Failed to fetch ${type}:`, err);
      }
    };

    fetchFieldMap('candidates_source', setSourceMap);
    fetchFieldMap('candidates_post', setPositionMap);
    fetchFieldMap('candidates_status', setStatusMap);
  }, []);

  const fetchCandidates = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit });
      if (search.trim()) params.append('search', search.trim());
      const res = await apiFetch(`candidates?${params.toString()}`);
      if (res.success) {
        setCandidates(res.data || []);
        if (res.pagination) {
          setPagination(res.pagination);
        }
      }
    } catch (err) {
      console.error('Fetch candidates error:', err);
    }
    setLoading(false);
  }, [page, search]);

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  // Reset page when search changes
  useEffect(() => {
    setPage(1);
  }, [search]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await apiFetch(`candidates/${deleteId}`, { method: 'DELETE' });
      if (res.success) {
        showToast('Candidate deleted');
        fetchCandidates();
      } else {
        showToast(res.message || 'Failed to delete', 'error');
      }
    } catch (err) {
      showToast('Failed to delete', 'error');
    }
    setShowDeleteModal(false);
    setDeleteId(null);
  };

  const formatDate = (dt) =>
    dt
      ? new Date(dt).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : '-';

  const getStatusColor = (statusName) => {
    const name = (statusName || '').toLowerCase();
    if (name.includes('select') || name.includes('hired') || name.includes('accept')) return '#22c55e';
    if (name.includes('reject') || name.includes('fail')) return '#ef4444';
    if (name.includes('hold') || name.includes('pend') || name.includes('wait')) return '#f59e0b';
    if (name.includes('interview') || name.includes('process')) return '#3b82f6';
    return '#6b7280';
  };

  return (
    <div>
      <Header
        title="All Candidates"
        subtitle={`${pagination.total || candidates.length} candidates`}
        actions={
          <Button variant="gold" icon={Plus} onClick={() => navigate('/hr/candidates/add')}>
            Add Candidate
          </Button>
        }
      />
      <div className="page">
        {/* Search */}
        <div className="cand-filters">
          <div className="cand-filters__search">
            <Search size={16} />
            <input
              placeholder="Search by name, mobile, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Table */}
        <div className="cand-table-wrap">
          <table className="cand-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Contact</th>
                <th>Source</th>
                <th>Position</th>
                <th>Status</th>
                <th>Location</th>
                <th>DOB</th>
                <th>CV</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" className="cand-table__empty">
                    Loading...
                  </td>
                </tr>
              ) : candidates.length === 0 ? (
                <tr>
                  <td colSpan="9" className="cand-table__empty">
                    No candidates found
                  </td>
                </tr>
              ) : (
                candidates.map((cand) => {
                  const statusName = statusMap[cand.status_id] || '-';
                  const statusColor = getStatusColor(statusName);
                  return (
                    <tr key={cand.cand_id} className="cand-table__row">
                      <td>
                        <div className="cand-table__name-cell">
                          <div className="cand-table__avatar">
                            {cand.name
                              ? cand.name
                                  .split(/[\s._]/)
                                  .map((n) => n[0])
                                  .join('')
                                  .toUpperCase()
                                  .slice(0, 2)
                              : '?'}
                          </div>
                          <span className="cand-table__name">{cand.name}</span>
                        </div>
                      </td>
                      <td>
                        <div className="cand-table__contact">
                          <span>{cand.country_code} {cand.mobile}</span>
                          {cand.email && <span className="cand-table__email-text">{cand.email}</span>}
                        </div>
                      </td>
                      <td>
                        <span className="cand-table__text">{sourceMap[cand.source_id] || '-'}</span>
                      </td>
                      <td>
                        <span className="cand-table__text">{positionMap[cand.position_id] || '-'}</span>
                      </td>
                      <td>
                        <span
                          className="cand-status-badge"
                          style={{
                            background: statusColor + '15',
                            color: statusColor,
                          }}
                        >
                          {statusName}
                        </span>
                      </td>
                      <td>
                        <span className="cand-table__text">{cand.location || '-'}</span>
                      </td>
                      <td>
                        <span className="cand-table__date">{formatDate(cand.date_of_birth)}</span>
                      </td>
                      <td>
                        {cand.cv_path ? (
                          <a
                            href={`${cand.cv_path}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="cand-cv-link"
                            title={cand.cv_name || 'Download CV'}
                          >
                            <Download size={14} />
                            <span>CV</span>
                          </a>
                        ) : (
                          <span className="cand-table__text">-</span>
                        )}
                      </td>
                      <td>
                        <div className="cand-table__actions">
                          <button
                            className="cand-action-btn"
                            title="Edit"
                            onClick={() => navigate(`/hr/candidates/edit/${cand.cand_id}`)}
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            className="cand-action-btn cand-action-btn--danger"
                            title="Delete"
                            onClick={() => {
                              setDeleteId(cand.cand_id);
                              setShowDeleteModal(true);
                            }}
                          >
                            <Trash2 size={15} />
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

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="cand-pagination">
            <span className="cand-pagination__info">
              Page {page} of {pagination.totalPages} ({pagination.total} total)
            </span>
            <div className="cand-pagination__btns">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </button>
              <button disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Modal */}
      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete Candidate" size="sm">
        <p style={{ color: 'var(--gray-600)', marginBottom: 20 }}>
          Are you sure you want to delete this candidate? This action cannot be undone.
        </p>
        <div className="modal__actions">
          <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
            Cancel
          </Button>
          <Button variant="danger" icon={Trash2} onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </Modal>

      {toast && <div className={`broker-toast broker-toast--${toast.type}`}>{toast.message}</div>}
    </div>
  );
};

export default AllCandidates;
