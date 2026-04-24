import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import {
  FolderKanban, Plus, Search, Trash2, Edit2, Eye,
  Calendar, CheckCircle2, AlertCircle, Building2, MapPin
} from 'lucide-react';
import './AllProjects.css';

const TYPE_COLORS = {
  Residential: { color: '#2563eb', bg: '#eff6ff' },
  Commercial:  { color: '#7c3aed', bg: '#f5f3ff' },
  Mixed:       { color: '#b45309', bg: '#fffbeb' },
};

const STATUS_COLORS = {
  'Pre-Launch':           { color: '#b45309', bg: '#fef3c7' },
  'Under Construction':   { color: '#d97706', bg: '#fef3c7' },
  'Nearing Completion':   { color: '#2563eb', bg: '#eff6ff' },
  'Ready to Move':        { color: '#059669', bg: '#ecfdf5' },
  'Completed':            { color: '#059669', bg: '#ecfdf5' },
};

export default function AllProjects() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('projects');
      if (res.success) {
        setProjects(Array.isArray(res.data) ? res.data : []);
      }
    } catch (err) {
      console.error('Fetch projects error:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const filtered = projects.filter(p => {
    const q = search.toLowerCase();
    return !q ||
      (p.name || '').toLowerCase().includes(q) ||
      (p.developer || '').toLowerCase().includes(q) ||
      (p.rera_number || '').toLowerCase().includes(q) ||
      (p.city || p.location || '').toLowerCase().includes(q);
  });

  const handleDelete = async (id) => {
    try {
      const res = await apiFetch(`projects/${id}`, { method: 'DELETE' });
      if (res.success) { showToast('Project deleted'); fetchProjects(); }
      else showToast(res.message || 'Failed', 'error');
    } catch (err) { showToast('Failed to delete', 'error'); }
    setDeleteConfirm(null);
  };

  const activeCount = projects.filter(p => p.is_active !== false).length;
  const inactiveCount = projects.filter(p => p.is_active === false).length;

  return (
    <div className="ajp-page">
      <div className="ajp-header">
        <div>
          <h1 className="ajp-header__title">All Projects</h1>
          <p className="ajp-header__sub">{projects.length} projects registered</p>
        </div>
        <button className="ajp-btn-primary" onClick={() => navigate('/projects/add')}>
          <Plus size={16} /> New Project
        </button>
      </div>

      {/* Stats */}
      <div className="ajp-stats">
        {[
          { label: 'Total Projects', value: projects.length, icon: FolderKanban, color: '#1a2035', bg: '#f1f5f9' },
          { label: 'Active', value: activeCount, icon: CheckCircle2, color: '#16a34a', bg: '#dcfce7' },
          { label: 'Inactive', value: inactiveCount, icon: AlertCircle, color: '#d97706', bg: '#fef3c7' },
        ].map(s => (
          <div className="ajp-stat" key={s.label}>
            <div className="ajp-stat__icon" style={{ color: s.color, background: s.bg }}><s.icon size={22} /></div>
            <div>
              <p className="ajp-stat__val">{s.value}</p>
              <p className="ajp-stat__label">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="ajp-toolbar">
        <div className="ajp-search">
          <Search size={15} />
          <input placeholder="Search by name, developer, RERA, city..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Table */}
      <div className="ajp-table-wrap">
        <table className="ajp-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Project Name</th>
              <th>Developer</th>
              <th>RERA</th>
              <th>Type</th>
              <th>Status</th>
              <th>Towers</th>
              <th>Units</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="ajp-empty">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} className="ajp-empty"><FolderKanban size={36} style={{ opacity: 0.2, marginBottom: 8 }} /><p>No projects found</p></td></tr>
            ) : filtered.map((p, i) => {
              const typeStyle = TYPE_COLORS[p.project_type] || { color: '#64748b', bg: '#f1f5f9' };
              const statusStyle = STATUS_COLORS[p.construction_status] || { color: '#64748b', bg: '#f1f5f9' };
              return (
                <tr key={p.project_id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/projects/view/${p.project_id}`)}>
                  <td className="ajp-td--muted">{i + 1}</td>
                  <td>
                    <div className="ajp-project-name">
                      <div className="ajp-project-icon"><Building2 size={15} /></div>
                      <span className="ajp-td--bold">{p.name}</span>
                    </div>
                  </td>
                  <td className="ajp-td--muted">{p.developer || '-'}</td>
                  <td className="ajp-td--muted" style={{ fontFamily: 'monospace', fontSize: 12 }}>{p.rera_number || '-'}</td>
                  <td>
                    {p.project_type ? (
                      <span className="ajp-badge" style={{ color: typeStyle.color, background: typeStyle.bg }}>
                        {p.project_type}
                      </span>
                    ) : '-'}
                  </td>
                  <td>
                    {p.construction_status ? (
                      <span className="ajp-badge" style={{ color: statusStyle.color, background: statusStyle.bg }}>
                        {p.construction_status}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="ajp-td--muted">{p.total_towers ?? '-'}</td>
                  <td className="ajp-td--muted">{p.total_units ?? '-'}</td>
                  <td className="ajp-td--actions" onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="ajp-icon-btn" title="View" onClick={() => navigate(`/projects/view/${p.project_id}`)}>
                        <Eye size={15} />
                      </button>
                      <button className="ajp-icon-btn" title="Edit" onClick={() => navigate(`/projects/edit/${p.project_id}`)}>
                        <Edit2 size={15} />
                      </button>
                      <button className="ajp-icon-btn" title="Delete" onClick={() => setDeleteConfirm(p.project_id)} style={{ color: '#ef4444' }}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="ajp-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="ajp-confirm" onClick={e => e.stopPropagation()}>
            <div className="ajp-confirm__icon"><Trash2 size={28} /></div>
            <h3>Delete Project?</h3>
            <p>This action cannot be undone.</p>
            <div className="ajp-confirm__btns">
              <button className="ajp-btn-ghost" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="ajp-btn-danger" onClick={() => handleDelete(deleteConfirm)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
