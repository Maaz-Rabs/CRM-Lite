import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/layout/Header';
import { apiFetch, getFileUrl } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import {
  Users, Loader2, Search, Calendar, TrendingUp, TrendingDown,
  ChevronRight
} from 'lucide-react';
import './LeadsReport.css';

const formatDate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const LeadsReport = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);

  const [startDate, setStartDate] = useState(formatDate(firstDay));
  const [endDate, setEndDate] = useState(formatDate(now));
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`reports/users?start_date=${startDate}&end_date=${endDate}`);
      if (res.success) {
        setUsers(res.data?.users || []);
      } else {
        showToast(res.message || 'Failed to load report', 'error');
      }
    } catch {
      showToast('Connection failed', 'error');
    }
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadUsers(); }, [startDate, endDate]);

  const openUser = (user) => {
    navigate(`/leads-report/${user.u_id}`);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u =>
      (u.full_name || '').toLowerCase().includes(q) ||
      (u.username || '').toLowerCase().includes(q) ||
      (u.role_name || '').toLowerCase().includes(q)
    );
  }, [users, search]);

  const totals = useMemo(() => {
    return users.reduce((acc, u) => ({
      leads: acc.leads + (u.total_leads || 0),
      activities: acc.activities + (u.total_activities || 0),
      calls: acc.calls + (u.total_calls || 0),
      users: acc.users + 1,
    }), { leads: 0, activities: 0, calls: 0, users: 0 });
  }, [users]);

  return (
    <div>
      <Header title="Leads Report" subtitle="User-wise lead performance" />
      <div className="page">
        {/* Filter bar */}
        <div className="lrpt-filterbar">
          <div className="lrpt-filter-group">
            <Calendar size={14} />
            <label>From</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="lrpt-date"
            />
            <label>To</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="lrpt-date"
            />
          </div>
          <div className="lrpt-search">
            <Search size={14} />
            <input
              type="text"
              placeholder="Search user or role…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Totals */}
        <div className="lrpt-totals">
          <div className="lrpt-total-card">
            <span className="lrpt-total-label">Team Size</span>
            <span className="lrpt-total-value">{totals.users}</span>
          </div>
          <div className="lrpt-total-card">
            <span className="lrpt-total-label">Total Leads</span>
            <span className="lrpt-total-value">{totals.leads}</span>
          </div>
          <div className="lrpt-total-card">
            <span className="lrpt-total-label">Activities</span>
            <span className="lrpt-total-value">{totals.activities}</span>
          </div>
          <div className="lrpt-total-card">
            <span className="lrpt-total-label">Calls</span>
            <span className="lrpt-total-value">{totals.calls}</span>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="lrpt-loading"><Loader2 size={18} className="spin" /> Loading report…</div>
        ) : filtered.length === 0 ? (
          <div className="lrpt-empty">
            <Users size={28} />
            <span>No users match your filters</span>
          </div>
        ) : (
          <div className="lrpt-table-wrap">
            <table className="lrpt-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th className="lrpt-num">Total Leads</th>
                  <th className="lrpt-num">Activities</th>
                  <th className="lrpt-num">Calls</th>
                  <th className="lrpt-num">Call Mins</th>
                  <th className="lrpt-num">Present Days</th>
                  <th className="lrpt-num">Trend</th>
                  <th className="lrpt-num"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <tr
                    key={u.u_id}
                    className="lrpt-row"
                    onClick={() => openUser(u)}
                  >
                    <td>
                      <div className="lrpt-user">
                        <div className="lrpt-avatar">
                          {u.profile_image ? (
                            <img src={getFileUrl(u.profile_image)} alt={u.full_name} />
                          ) : (
                            <span>{(u.full_name || u.username || '?').trim().charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        <div className="lrpt-user-meta">
                          <span className="lrpt-user-name">{u.full_name || u.username}</span>
                          {u.designation && <span className="lrpt-user-sub">{u.designation}</span>}
                        </div>
                      </div>
                    </td>
                    <td><span className="lrpt-role-pill">{u.role_name || '—'}</span></td>
                    <td className="lrpt-num lrpt-num--strong">{u.total_leads || 0}</td>
                    <td className="lrpt-num">{u.total_activities || 0}</td>
                    <td className="lrpt-num">{u.total_calls || 0}</td>
                    <td className="lrpt-num">{u.call_duration_mins || 0}</td>
                    <td className="lrpt-num">{u.present_days || 0}</td>
                    <td className="lrpt-num">
                      {u.change_percent === null || u.change_percent === undefined ? (
                        <span className="lrpt-trend lrpt-trend--flat">—</span>
                      ) : u.change_percent >= 0 ? (
                        <span className="lrpt-trend lrpt-trend--up">
                          <TrendingUp size={12} /> {u.change_percent}%
                        </span>
                      ) : (
                        <span className="lrpt-trend lrpt-trend--down">
                          <TrendingDown size={12} /> {u.change_percent}%
                        </span>
                      )}
                    </td>
                    <td className="lrpt-num"><ChevronRight size={16} className="lrpt-chev" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};

export default LeadsReport;
