import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, STORAGE_KEYS } from '../../utils/api';
import Header from '../../components/layout/Header';
import { Button, Modal } from '../../components/common/Common';
import { useAuth } from '../../context/AuthContext';
import { Plus, Search, Edit2, Trash2, Eye, ToggleLeft, ToggleRight, LogIn } from 'lucide-react';
import './Users.css';

const BACKUP_KEY = 'rabs_impersonator_backup';

const AllUsers = () => {
  const navigate = useNavigate();
  const { user: currentUser, isAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [toast, setToast] = useState(null);
  const [impersonateUser, setImpersonateUser] = useState(null);
  const [impersonating, setImpersonating] = useState(false);

  const showToast = (msg, type = 'success') => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('users');
      if (res.success) {
        setUsers(res.data?.users || []);
      }
    } catch (err) {
      console.error('Fetch users error:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchSearch = !q || u.username?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.role_name?.toLowerCase().includes(q);
    const matchRole = roleFilter === 'all' || u.role_slug === roleFilter;
    return matchSearch && matchRole;
  });

  const roles = [...new Set(users.map(u => u.role_slug).filter(Boolean))];

  const handleToggleStatus = async (user) => {
    try {
      const res = await apiFetch(`users/${user.u_id}/status`, { method: 'PATCH' });
      if (res.success) {
        showToast(`User ${user.is_active ? 'deactivated' : 'activated'}`);
        fetchUsers();
      }
    } catch (err) {
      showToast('Failed to update status', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await apiFetch(`users/${deleteId}`, { method: 'DELETE' });
      if (res.success) {
        showToast('User deleted');
        fetchUsers();
      } else {
        showToast(res.message || 'Failed to delete', 'error');
      }
    } catch (err) {
      showToast('Failed to delete', 'error');
    }
    setShowDeleteModal(false);
    setDeleteId(null);
  };

  const openDetail = (user) => {
    setSelectedUser(user);
    setShowDetail(true);
  };

  const confirmImpersonate = async () => {
    if (!impersonateUser) return;
    setImpersonating(true);
    try {
      const res = await apiFetch('auth/impersonate', {
        method: 'POST',
        body: JSON.stringify({ user_id: impersonateUser.u_id }),
      });
      if (!res.success) {
        showToast(res.message || 'Could not log in as this user', 'error');
        setImpersonating(false);
        return;
      }

      // Back up original identity so we can return
      try {
        const backup = {
          user: JSON.parse(localStorage.getItem(STORAGE_KEYS.USER_DATA) || 'null'),
          tokens: JSON.parse(localStorage.getItem(STORAGE_KEYS.TOKENS) || 'null'),
          permissions: JSON.parse(localStorage.getItem(STORAGE_KEYS.PERMISSIONS) || '[]'),
        };
        localStorage.setItem(BACKUP_KEY, JSON.stringify(backup));
      } catch { }

      // Swap in the impersonated user's session
      const { user, tokens, permissions } = res.data || {};
      localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
      localStorage.setItem(STORAGE_KEYS.TOKENS, JSON.stringify(tokens));
      localStorage.setItem(STORAGE_KEYS.PERMISSIONS, JSON.stringify(permissions || []));

      // Reload into the impersonated CRM
      window.location.href = '/';
    } catch (err) {
      showToast('Connection failed', 'error');
      setImpersonating(false);
    }
  };

  const getInitials = (name) => name ? name.split(/[\s._]/).map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?';
  const getRoleColor = (slug) => {
    const map = { master: '#ef4444', admin: '#f59e0b', branch_admin: '#8b5cf6', team_leader: '#3b82f6', sales_manager: '#06b6d4', tele_caller: '#22c55e', hr_head: '#ec4899', hr: '#f472b6' };
    return map[slug] || '#6b7280';
  };
  const formatDate = (dt) => dt ? new Date(dt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

  return (
    <div>
      <Header
        title="Users"
        subtitle={`${users.length} team members`}
        actions={<Button variant="gold" icon={Plus} onClick={() => navigate('/users/add')}>Add User</Button>}
      />
      <div className="page">
        {/* Filters */}
        <div className="usr-filters">
          <div className="usr-filters__search">
            <Search size={16} />
            <input placeholder="Search by name, email, role..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="usr-filters__chips">
            <button className={`filter-chip ${roleFilter === 'all' ? 'filter-chip--active' : ''}`} onClick={() => setRoleFilter('all')}>All</button>
            {roles.map(r => (
              <button key={r} className={`filter-chip ${roleFilter === r ? 'filter-chip--active' : ''}`} onClick={() => setRoleFilter(r)} style={{ textTransform: 'capitalize' }}>
                {r.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="usr-table-wrap">
          <table className="usr-table">
            <thead>
              <tr>
                <th style={{ width: 48 }}>#</th>
                <th>User</th>
                <th>Role</th>
                <th>Email</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" className="usr-table__empty">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan="7" className="usr-table__empty">No users found</td></tr>
              ) : filtered.map((user, idx) => (
                <tr key={user.u_id} className="usr-table__row">
                  <td className="usr-table__serial">{idx + 1}</td>
                  <td>
                    <div className="usr-table__name-cell">
                      <div className="usr-table__avatar" style={{ borderColor: getRoleColor(user.role_slug) }}>
                        {getInitials(user.username)}
                      </div>
                      <span className="usr-table__name">{user.username}</span>
                    </div>
                  </td>
                  <td>
                    <span className="usr-role-badge" style={{ background: getRoleColor(user.role_slug) + '15', color: getRoleColor(user.role_slug) }}>
                      {user.role_name}
                    </span>
                  </td>
                  <td><span className="usr-table__email">{user.email || '-'}</span></td>
                  <td>
                    <button className="usr-toggle" onClick={() => handleToggleStatus(user)}>
                      {user.is_active ? <ToggleRight size={22} className="usr-toggle--on" /> : <ToggleLeft size={22} className="usr-toggle--off" />}
                    </button>
                  </td>
                  <td><span className="usr-table__date">{formatDate(user.created_at)}</span></td>
                  <td>
                    <div className="usr-table__actions">
                      {isAdmin && user.u_id !== currentUser?.id && user.is_active && (
                        <button
                          className="usr-action-btn usr-action-btn--primary"
                          title={`Log in as ${user.username}`}
                          onClick={() => setImpersonateUser(user)}
                        >
                          <LogIn size={15} />
                        </button>
                      )}
                      <button className="usr-action-btn" title="View" onClick={() => openDetail(user)}><Eye size={15} /></button>
                      <button className="usr-action-btn" title="Edit" onClick={() => navigate(`/users/edit/${user.u_id}`)}><Edit2 size={15} /></button>
                      <button className="usr-action-btn usr-action-btn--danger" title="Delete" onClick={() => { setDeleteId(user.u_id); setShowDeleteModal(true); }}><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      <Modal isOpen={showDetail} onClose={() => setShowDetail(false)} title="User Details" size="md">
        {selectedUser && (
          <div className="usr-detail">
            <div className="usr-detail__header">
              <div className="usr-detail__avatar" style={{ borderColor: getRoleColor(selectedUser.role_slug) }}>
                {getInitials(selectedUser.username)}
              </div>
              <div>
                <h3 className="usr-detail__name">{selectedUser.username}</h3>
                <span className="usr-role-badge" style={{ background: getRoleColor(selectedUser.role_slug) + '15', color: getRoleColor(selectedUser.role_slug) }}>
                  {selectedUser.role_name}
                </span>
              </div>
              <div style={{ marginLeft: 'auto' }}>
                <Button variant="outline" icon={Edit2} size="sm" onClick={() => { setShowDetail(false); navigate(`/users/edit/${selectedUser.u_id}`); }}>Edit</Button>
              </div>
            </div>
            <div className="usr-detail__grid">
              <div className="usr-detail__item"><span className="usr-detail__label">Email</span><span className="usr-detail__value">{selectedUser.email || '-'}</span></div>
              <div className="usr-detail__item"><span className="usr-detail__label">Status</span><span className="usr-detail__value" style={{ color: selectedUser.is_active ? '#22c55e' : '#ef4444' }}>{selectedUser.is_active ? 'Active' : 'Inactive'}</span></div>
              <div className="usr-detail__item"><span className="usr-detail__label">Joined</span><span className="usr-detail__value">{formatDate(selectedUser.created_at)}</span></div>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Modal */}
      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete User" size="sm">
        <p style={{ color: 'var(--gray-600)', marginBottom: 20 }}>Are you sure? This will deactivate the user and remove their access.</p>
        <div className="modal__actions">
          <Button variant="outline" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
          <Button variant="danger" icon={Trash2} onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>

      {/* Impersonate Modal */}
      <Modal isOpen={!!impersonateUser} onClose={() => !impersonating && setImpersonateUser(null)} title="Log in as user" size="sm">
        {impersonateUser && (
          <>
            <p style={{ color: 'var(--gray-700)', marginBottom: 10 }}>
              You will switch to <strong>{impersonateUser.username}</strong>'s CRM and see what they see.
            </p>
            <p style={{ color: 'var(--gray-500)', fontSize: 12.5, marginBottom: 20 }}>
              A "Return to my account" banner will appear at the top so you can switch back anytime.
            </p>
            <div className="modal__actions">
              <Button variant="outline" onClick={() => setImpersonateUser(null)} disabled={impersonating}>Cancel</Button>
              <Button variant="gold" icon={LogIn} onClick={confirmImpersonate} disabled={impersonating}>
                {impersonating ? 'Logging in…' : `Log in as ${impersonateUser.username}`}
              </Button>
            </div>
          </>
        )}
      </Modal>

      {toast && <div className={`broker-toast broker-toast--${toast.type}`}>{toast.message}</div>}
    </div>
  );
};

export default AllUsers;
