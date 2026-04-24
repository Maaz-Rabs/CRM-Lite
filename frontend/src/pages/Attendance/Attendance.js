import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Header from '../../components/layout/Header';
import { StatCard, Table, Badge } from '../../components/common/Common';
import {
  CalendarClock, UserCheck, Clock, AlertTriangle,
  Calendar, ChevronLeft, ChevronRight, TrendingUp,
} from 'lucide-react';
import { apiFetch } from '../../utils/api';
import './Attendance.css';

const STATUS_LABEL = {
  present: 'Present', halfday: 'Half Day', absent: 'Absent',
  leave: 'Leave', forgot_logout: 'Forgot Logout', holiday: 'Holiday', weekend: 'Weekend',
};
const STATUS_COLOR = {
  present: 'var(--success)', halfday: 'var(--warning)', absent: 'var(--danger)',
  leave: 'var(--gray-400)', forgot_logout: '#bd7f0d', holiday: 'var(--primary)', weekend: 'var(--gray-300)',
};

const AttBadge = ({ status }) => (
  <span className="att-status-badge" style={{ background: STATUS_COLOR[status] || 'var(--gray-200)', color: '#fff' }}>
    {STATUS_LABEL[status] || status}
  </span>
);

const getMonthRange = (monthStr) => {
  const [y, m] = monthStr.split('-').map(Number);
  const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const endDate = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { startDate, endDate };
};

const Attendance = () => {
  const { tab } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const [activeTab, setActiveTab] = useState(tab === 'monthly' ? 'monthly' : 'daily');

  useEffect(() => {
    if (tab === 'daily' || tab === 'monthly') setActiveTab(tab);
  }, [tab]);

  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    navigate(`/attendance/${newTab}`, { replace: true });
  };

  // ── Daily state ──
  const [dailyDate, setDailyDate] = useState(new Date().toISOString().split('T')[0]);
  const [dailyData, setDailyData] = useState(null);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [dailyError, setDailyError] = useState(null);
  const [selectedDailyUser, setSelectedDailyUser] = useState(null);

  // ── Monthly state ──
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [monthlyData, setMonthlyData] = useState(null);
  const [monthlyStats, setMonthlyStats] = useState(null);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [monthlyError, setMonthlyError] = useState(null);
  const [selectedMonthlyUser, setSelectedMonthlyUser] = useState(null);

  // ── Fetch Daily ──
  const fetchDailyReport = useCallback(async () => {
    setDailyLoading(true);
    setDailyError(null);
    setSelectedDailyUser(null);
    try {
      if (isAdmin) {
        const res = await apiFetch(`attendance/admin/daily?date=${dailyDate}`);
        if (res.success) {
          setDailyData(res.data);
        } else {
          setDailyError(res.message || 'Failed to load daily report');
          setDailyData(null);
        }
      } else {
        // Regular user — own sessions
        const res = await apiFetch(`attendance/history?startDate=${dailyDate}&endDate=${dailyDate}`);
        if (res.success) {
          const dayData = res.data?.history?.[0];
          setDailyData({ sessions: dayData?.sessions || [], isUser: true });
        } else {
          setDailyData(null);
          setDailyError(res.message || 'Failed to load daily report');
        }
      }
    } catch (e) {
      console.error(e);
      setDailyData(null);
      setDailyError(e.message || 'Connection failed');
    }
    setDailyLoading(false);
  }, [dailyDate, isAdmin]);

  // ── Fetch Monthly ──
  const fetchMonthlyReport = useCallback(async () => {
    setMonthlyLoading(true);
    setMonthlyError(null);
    setSelectedMonthlyUser(null);
    setMonthlyData(null);
    setMonthlyStats(null);
    try {
      const { startDate, endDate } = getMonthRange(month);
      if (isAdmin) {
        const res = await apiFetch(`attendance/admin/monthly?startDate=${startDate}&endDate=${endDate}`);
        if (res.success) {
          setMonthlyData(res.data);
        } else {
          setMonthlyError(res.message || 'Failed to load monthly report');
        }
      } else {
        const [historyRes, statsRes] = await Promise.all([
          apiFetch(`attendance/history?startDate=${startDate}&endDate=${endDate}`),
          apiFetch(`attendance/stats?startDate=${startDate}&endDate=${endDate}`),
        ]);
        if (historyRes.success) {
          setMonthlyData({ history: historyRes.data?.history || [] });
        } else {
          setMonthlyError(historyRes.message || 'Failed to load monthly report');
        }
        if (statsRes.success) setMonthlyStats(statsRes.data?.stats);
      }
    } catch (e) {
      console.error(e);
      setMonthlyError(e.message || 'Connection failed');
    }
    setMonthlyLoading(false);
  }, [month, isAdmin]);

  // ── Admin drill-down: fetch a specific user's monthly detail ──
  const fetchUserMonthlyDetail = useCallback(async (user) => {
    setSelectedMonthlyUser(user);
    setMonthlyLoading(true);
    setMonthlyError(null);
    try {
      const { startDate, endDate } = getMonthRange(month);
      // FIX: use admin/user-detail endpoint, not history (history ignores user_id)
      const res = await apiFetch(
        `attendance/admin/user-detail?user_id=${user.u_id}&startDate=${startDate}&endDate=${endDate}`
      );
      if (res.success) {
        setMonthlyData({ userDetail: true, history: res.data.history || [], stats: res.data.stats });
        setMonthlyStats(res.data.stats);
      } else {
        setMonthlyError(res.message || 'Failed to load user detail');
      }
    } catch (e) {
      console.error(e);
      setMonthlyError(e.message || 'Connection failed');
    }
    setMonthlyLoading(false);
  }, [month]);

  useEffect(() => {
    if (activeTab === 'daily') fetchDailyReport();
  }, [activeTab, fetchDailyReport]);

  useEffect(() => {
    if (activeTab === 'monthly') fetchMonthlyReport();
  }, [activeTab, fetchMonthlyReport]);

  const shiftDate = (days) => {
    const d = new Date(dailyDate);
    d.setDate(d.getDate() + days);
    setDailyDate(d.toISOString().split('T')[0]);
  };

  const shiftMonth = (delta) => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  // ══════════════════════════════════════════════
  //  DAILY REPORT
  // ══════════════════════════════════════════════
  const renderDaily = () => {
    const adminRecords = dailyData?.records;
    const summary = dailyData?.summary;

    return (
      <>
        {isAdmin && summary && (
          <div className="page__grid page__grid--stats" style={{ marginBottom: 20 }}>
            <StatCard icon={UserCheck} label="Present" value={summary.present || 0} accent />
            <StatCard icon={Clock} label="Half Day" value={summary.halfday || 0} />
            <StatCard icon={AlertTriangle} label="Absent" value={summary.absent || 0} />
            <StatCard icon={CalendarClock} label="On Leave" value={(summary.leave || 0) + (summary.forgot_logout || 0)} />
          </div>
        )}

        <div className="card">
          <div className="card__header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button className="att-nav-btn" onClick={() => shiftDate(-1)}><ChevronLeft size={16} /></button>
              <input
                type="date"
                value={dailyDate}
                onChange={e => setDailyDate(e.target.value)}
                className="form-input"
                style={{ width: 160, padding: '7px 12px', fontSize: 13 }}
              />
              <button
                className="att-nav-btn"
                onClick={() => shiftDate(1)}
                disabled={dailyDate >= new Date().toISOString().split('T')[0]}
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <Badge variant="primary">
              {isAdmin
                ? selectedDailyUser
                  ? selectedDailyUser.username
                  : `${adminRecords?.length || 0} Members`
                : `${dailyData?.sessions?.length || 0} Sessions`}
            </Badge>
          </div>

          <div className="card__body" style={{ padding: 0 }}>
            {dailyLoading ? (
              <div className="att-loading">Loading...</div>
            ) : dailyError ? (
              <div className="att-loading" style={{ color: 'var(--danger)' }}>{dailyError}</div>
            ) : isAdmin && !selectedDailyUser ? (
              // Admin: All users
              <Table
                columns={[
                  {
                    header: 'Employee', render: r => (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="avatar avatar--navy" style={{ width: 34, height: 34, fontSize: 12 }}>
                          {(r.username || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p style={{ fontWeight: 600, color: 'var(--navy-800)', fontSize: 13 }}>{r.username}</p>
                          <p style={{ fontSize: 11, color: 'var(--gray-500)' }}>{r.role_name || ''}</p>
                        </div>
                      </div>
                    )
                  },
                  { header: 'Punch In', render: r => <span style={{ fontSize: 13 }}>{r.first_punch_in || '--'}</span> },
                  { header: 'Punch Out', render: r => <span style={{ fontSize: 13 }}>{r.last_punch_out || '--'}</span> },
                  { header: 'Hours', render: r => <span style={{ fontWeight: 600, fontSize: 13 }}>{r.total_hours_fmt || '--'}</span> },
                  { header: 'Sessions', render: r => <Badge variant="default">{r.total_sessions || 0}</Badge> },
                  { header: 'Status', render: r => <AttBadge status={r.status} /> },
                  {
                    header: '', render: r => r.total_sessions > 0 ? (
                      <button className="btn btn--primary btn--sm" onClick={() => setSelectedDailyUser(r)}>
                        Details
                      </button>
                    ) : null
                  },
                ]}
                data={adminRecords || []}
                emptyMessage="No attendance records for this date"
              />
            ) : isAdmin && selectedDailyUser ? (
              // Admin: User sessions drill-down
              <>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="avatar avatar--navy" style={{ width: 34, height: 34, fontSize: 12 }}>
                      {(selectedDailyUser.username || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p style={{ fontWeight: 600, color: 'var(--navy-800)', fontSize: 14, margin: 0 }}>{selectedDailyUser.username}</p>
                      <p style={{ fontSize: 11, color: 'var(--gray-500)', margin: 0 }}>{selectedDailyUser.role_name || ''}</p>
                    </div>
                  </div>
                  <button className="btn btn--secondary btn--sm" onClick={() => setSelectedDailyUser(null)}>
                    ← Back to All
                  </button>
                </div>
                <Table
                  columns={[
                    { header: 'Session', render: r => <Badge variant="primary">#{r.session_no}</Badge> },
                    { header: 'Punch In', render: r => <span style={{ fontSize: 13 }}>{r.punch_in_time || '--'}</span> },
                    { header: 'Punch Out', render: r => <span style={{ fontSize: 13 }}>{r.punch_out_time || '--'}</span> },
                    { header: 'Hours', render: r => <span style={{ fontWeight: 600, fontSize: 13 }}>{r.total_hours || '--'}</span> },
                    { header: 'Location', render: r => <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>{r.punch_in_address || '--'}</span> },
                    { header: 'Status', render: r => <AttBadge status={r.status} /> },
                  ]}
                  data={selectedDailyUser.sessions || []}
                  emptyMessage="No sessions found"
                />
              </>
            ) : (
              // Regular user: own sessions
              <Table
                columns={[
                  { header: 'Session', render: r => <Badge variant="primary">#{r.session_no}</Badge> },
                  { header: 'Punch In', render: r => <span style={{ fontSize: 13 }}>{r.punchIn || '--'}</span> },
                  { header: 'Punch Out', render: r => <span style={{ fontSize: 13 }}>{r.punchOut || '--'}</span> },
                  { header: 'Hours', render: r => <span style={{ fontWeight: 600, fontSize: 13 }}>{r.hours || '--'}</span> },
                  { header: 'Location', render: r => <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>{r.punchInAddress || '--'}</span> },
                ]}
                data={dailyData?.sessions || []}
                emptyMessage="No sessions found for this date"
              />
            )}
          </div>
        </div>
      </>
    );
  };

  // ══════════════════════════════════════════════
  //  MONTHLY REPORT
  // ══════════════════════════════════════════════
  const renderMonthly = () => {
    const isUserDetail = !!monthlyData?.userDetail;
    const stats = isUserDetail ? monthlyData?.stats : monthlyStats;

    return (
      <>
        {/* Stats cards for regular user or admin drill-down */}
        {(!isAdmin || isUserDetail) && stats && (
          <div className="page__grid page__grid--stats" style={{ marginBottom: 20 }}>
            <StatCard icon={UserCheck} label="Present Days" value={stats.presentDays || 0} accent />
            <StatCard icon={Clock} label="Half Days" value={stats.halfdayDays || 0} />
            <StatCard icon={AlertTriangle} label="Absent" value={stats.absentDays || 0} />
            <StatCard icon={TrendingUp} label="Total Hours" value={`${stats.totalHours || 0}h`} />
          </div>
        )}

        <div className="card">
          <div className="card__header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button className="att-nav-btn" onClick={() => shiftMonth(-1)}><ChevronLeft size={16} /></button>
              <input
                type="month"
                value={month}
                onChange={e => setMonth(e.target.value)}
                className="form-input"
                style={{ width: 160, padding: '7px 12px', fontSize: 13 }}
              />
              <button className="att-nav-btn" onClick={() => shiftMonth(1)}><ChevronRight size={16} /></button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {selectedMonthlyUser && (
                <button className="btn btn--secondary btn--sm" onClick={fetchMonthlyReport}>
                  ← Back to All
                </button>
              )}
              <Badge variant="primary">
                {isAdmin && !isUserDetail
                  ? `${monthlyData?.records?.length || 0} Members`
                  : `${monthlyData?.history?.length || 0} days`}
              </Badge>
            </div>
          </div>

          {/* Admin drill-down: user info bar */}
          {isAdmin && selectedMonthlyUser && (
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gray-100)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="avatar avatar--navy" style={{ width: 34, height: 34, fontSize: 12 }}>
                {(selectedMonthlyUser.username || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p style={{ fontWeight: 600, color: 'var(--navy-800)', fontSize: 14, margin: 0 }}>{selectedMonthlyUser.username}</p>
                <p style={{ fontSize: 11, color: 'var(--gray-500)', margin: 0 }}>{selectedMonthlyUser.role_name || ''}</p>
              </div>
            </div>
          )}

          <div className="card__body" style={{ padding: 0 }}>
            {monthlyLoading ? (
              <div className="att-loading">Loading...</div>
            ) : monthlyError ? (
              <div className="att-loading" style={{ color: 'var(--danger)' }}>{monthlyError}</div>
            ) : isAdmin && !isUserDetail ? (
              // Admin: all users summary
              <Table
                columns={[
                  {
                    header: 'Employee', render: r => (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="avatar avatar--navy" style={{ width: 34, height: 34, fontSize: 12 }}>
                          {(r.username || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p style={{ fontWeight: 600, color: 'var(--navy-800)', fontSize: 13 }}>{r.username}</p>
                          <p style={{ fontSize: 11, color: 'var(--gray-500)' }}>{r.role_name || ''}</p>
                        </div>
                      </div>
                    )
                  },
                  { header: 'Present', render: r => <span style={{ fontWeight: 600, color: 'var(--success)', fontSize: 13 }}>{r.present_days || 0}</span> },
                  { header: 'Half Day', render: r => <span style={{ fontWeight: 600, color: 'var(--warning)', fontSize: 13 }}>{r.halfday_days || 0}</span> },
                  { header: 'Absent', render: r => <span style={{ fontWeight: 600, color: 'var(--danger)', fontSize: 13 }}>{r.absent_days || 0}</span> },
                  { header: 'Leave', render: r => <span style={{ fontSize: 13 }}>{r.leave_days || 0}</span> },
                  { header: 'Forgot Logout', render: r => <span style={{ fontSize: 13, color: '#bd7f0d' }}>{r.forgot_logout_days || 0}</span> },
                  { header: 'Total Hours', render: r => <span style={{ fontWeight: 600, fontSize: 13 }}>{r.total_hours || 0}h</span> },
                  { header: 'Avg/Day', render: r => <span style={{ fontSize: 13 }}>{r.avg_hours || 0}h</span> },
                  {
                    header: '', render: r => (
                      <button className="btn btn--primary btn--sm" onClick={() => fetchUserMonthlyDetail(r)}>
                        View Details
                      </button>
                    )
                  },
                ]}
                data={monthlyData?.records || []}
                emptyMessage="No data found for this month"
              />
            ) : (
              // Regular user or admin drill-down: day-by-day cards with inline sessions
              (monthlyData?.history || []).length === 0 ? (
                <div className="att-loading">No attendance recorded this month</div>
              ) : (
                <div className="att-day-list">
                  {(monthlyData?.history || []).map(day => (
                    <div key={day.id} className="att-day-card">
                      <div className="att-day-card__header">
                        <div className="att-day-card__date">
                          <span className="att-day-card__date-main">{day.date}</span>
                          <span className="att-day-card__date-sub">{day.day}</span>
                        </div>
                        <div className="att-day-card__meta">
                          <Badge variant="default">{day.totalSessions} {day.totalSessions === 1 ? 'session' : 'sessions'}</Badge>
                          <span className="att-day-card__hours">{day.hours}</span>
                          <AttBadge status={day.status} />
                        </div>
                      </div>
                      {day.sessions && day.sessions.length > 0 && (
                        <div className="att-session-list">
                          <div className="att-session-row att-session-row--head">
                            <span>Session</span>
                            <span>Punch In</span>
                            <span>Punch Out</span>
                            <span>Duration</span>
                            <span>Location</span>
                          </div>
                          {day.sessions.map((s, idx) => {
                            const hrs = parseFloat(s.hours) || 0;
                            const durFmt = hrs > 0
                              ? `${Math.floor(hrs)}h ${Math.round((hrs % 1) * 60)}m`
                              : '--';
                            return (
                              <div key={idx} className="att-session-row">
                                <Badge variant="primary">#{s.session_no}</Badge>
                                <span>{s.punchIn || s.punch_in_time || '--'}</span>
                                <span>{s.punchOut || s.punch_out_time || '--'}</span>
                                <span style={{ fontWeight: 600 }}>{durFmt}</span>
                                <span className="att-session-row__loc">{s.punchInAddress || s.punch_in_address || '--'}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </div>
      </>
    );
  };

  return (
    <div>
      <Header title="Attendance Report" subtitle="Daily and monthly attendance tracking" />
      <div className="page">
        <div className="att-tabs">
          <button
            className={`att-tab ${activeTab === 'daily' ? 'att-tab--active' : ''}`}
            onClick={() => handleTabChange('daily')}
          >
            <Calendar size={15} /> Daily Report
          </button>
          <button
            className={`att-tab ${activeTab === 'monthly' ? 'att-tab--active' : ''}`}
            onClick={() => handleTabChange('monthly')}
          >
            <CalendarClock size={15} /> Monthly Report
          </button>
        </div>

        {activeTab === 'daily' ? renderDaily() : renderMonthly()}
      </div>
    </div>
  );
};

export default Attendance;