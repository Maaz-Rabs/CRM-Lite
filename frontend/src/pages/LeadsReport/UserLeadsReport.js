import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../../components/layout/Header';
import AdvancedSearch from '../../components/leads/AdvancedSearch';
import LeadTable from '../../components/leads/LeadTable';
import { Button } from '../../components/common/Common';
import useLeads from '../../hooks/useLeads';
import { apiFetch, getFileUrl } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import {
  ArrowLeft, PhoneCall, Activity, TrendingUp, Loader2, Calendar
} from 'lucide-react';
import './UserLeadsReport.css';

const formatDate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const UserLeadsReport = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const [startDate, setStartDate] = useState(formatDate(firstDay));
  const [endDate, setEndDate] = useState(formatDate(now));

  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(true);

  // Leads filtered to this user using existing /api/leads?assigned_to=...
  const {
    leads, loading, pagination, filters, setFilters, onSearch, onPageChange, refresh
  } = useLeads({ assigned_to: userId });

  const loadDetail = async () => {
    setDetailLoading(true);
    try {
      const res = await apiFetch(`reports/users/${userId}?start_date=${startDate}&end_date=${endDate}`);
      if (res.success) setDetail(res.data);
      else showToast(res.message || 'Failed to load user report', 'error');
    } catch {
      showToast('Connection failed', 'error');
    }
    setDetailLoading(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadDetail(); }, [userId, startDate, endDate]);

  const user = detail?.user;
  const initial = (user?.full_name || user?.username || '?').trim().charAt(0).toUpperCase();

  return (
    <div>
      <Header
        title="User Leads Report"
        subtitle={user ? `${user.full_name || user.username} · ${user.role_name || ''}` : 'Loading…'}
        actions={
          <Button variant="ghost" icon={ArrowLeft} onClick={() => navigate('/leads-report')}>
            Back to Reports
          </Button>
        }
      />

      <div className="page">
        {/* User summary card */}
        <div className="ulrpt-summary">
          <div className="ulrpt-summary-head">
            <div className="ulrpt-avatar">
              {user?.profile_image ? (
                <img src={getFileUrl(user.profile_image)} alt={user?.full_name || user?.username} />
              ) : (
                <span>{initial}</span>
              )}
            </div>
            <div className="ulrpt-user-meta">
              <h3 className="ulrpt-user-name">{user?.full_name || user?.username || 'Loading…'}</h3>
              <div className="ulrpt-user-badges">
                {user?.role_name && <span className="ulrpt-role-pill">{user.role_name}</span>}
                {user?.designation && <span className="ulrpt-designation">{user.designation}</span>}
              </div>
            </div>

            <div className="ulrpt-date-range">
              <Calendar size={14} />
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="ulrpt-date"
              />
              <span className="ulrpt-date-sep">→</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="ulrpt-date"
              />
            </div>
          </div>

          {detailLoading && !detail ? (
            <div className="ulrpt-loading"><Loader2 size={16} className="spin" /> Loading stats…</div>
          ) : detail && (
            <div className="ulrpt-stats-grid">
              <div className="ulrpt-stat">
                <span className="ulrpt-stat-label">Assigned Leads</span>
                <span className="ulrpt-stat-value">{detail.leads?.assigned || 0}</span>
              </div>
              <div className="ulrpt-stat">
                <span className="ulrpt-stat-label">New Assignments</span>
                <span className="ulrpt-stat-value">{detail.leads?.newAssignments || 0}</span>
              </div>
              <div className="ulrpt-stat">
                <span className="ulrpt-stat-label">Created Leads</span>
                <span className="ulrpt-stat-value">{detail.leads?.created || 0}</span>
              </div>
              <div className="ulrpt-stat">
                <span className="ulrpt-stat-label">Activities</span>
                <span className="ulrpt-stat-value"><Activity size={13} /> {detail.activities?.total || 0}</span>
              </div>
              <div className="ulrpt-stat">
                <span className="ulrpt-stat-label">Calls</span>
                <span className="ulrpt-stat-value"><PhoneCall size={13} /> {detail.calls?.total || 0}</span>
              </div>
              <div className="ulrpt-stat">
                <span className="ulrpt-stat-label">Conversion</span>
                <span className="ulrpt-stat-value"><TrendingUp size={13} /> {detail.conversion?.rate || 0}%</span>
              </div>
              <div className="ulrpt-stat">
                <span className="ulrpt-stat-label">Won / Lost</span>
                <span className="ulrpt-stat-value">{detail.conversion?.won || 0} / {detail.conversion?.lost || 0}</span>
              </div>
              <div className="ulrpt-stat">
                <span className="ulrpt-stat-label">Present Days</span>
                <span className="ulrpt-stat-value">{detail.attendance?.presentDays || 0}</span>
              </div>
            </div>
          )}

          {/* Leads by status */}
          {detail?.leads?.statusBreakdown && detail.leads.statusBreakdown.length > 0 && (
            <div className="ulrpt-statuses-row">
              <span className="ulrpt-statuses-label">Leads by Status:</span>
              {detail.leads.statusBreakdown.map((s, i) => (
                <span key={i} className="ulrpt-status-chip">
                  <span className="ulrpt-status-dot" style={{ background: s.status_color || '#94a3b8' }} />
                  <span>{s.status_name}</span>
                  <strong>{s.count}</strong>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Full Leads Table (same UX as Total Leads, filtered by this user) */}
        <div className="ulrpt-section-label">
          All Leads Assigned to this User{pagination.total ? ` · ${pagination.total}` : ''}
        </div>

        <AdvancedSearch
          filters={filters}
          setFilters={setFilters}
          onSearch={onSearch}
          showLeadType
        />
        <LeadTable
          leads={leads}
          loading={loading}
          pagination={pagination}
          onPageChange={onPageChange}
          onRefresh={refresh}
          showLeadType
        />
      </div>
    </div>
  );
};

export default UserLeadsReport;
