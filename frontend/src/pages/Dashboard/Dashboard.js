import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCRM } from '../../context/CRMContext';
import Header from '../../components/layout/Header';
import { StatCard } from '../../components/common/Common';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import {
  Users, TrendingUp, Target, Sparkles, UserCheck, UserX, Phone, ArrowUpRight,
  Calendar, Clock, Activity, Briefcase, Building2, Zap, CheckCircle
} from 'lucide-react';
import { apiFetch } from '../../utils/api';
import './Dashboard.css';

const COLORS = ['#1a3366', '#2a5298', '#3d6bb5', '#6b95d1', '#d4a819', '#f0d060', '#10b981', '#ef4444', '#8b5cf6', '#f59e0b'];

const Dashboard = () => {
  const { categoryCounts, masterData } = useCRM();
  const navigate = useNavigate();
  const [dashData, setDashData] = useState(null);
  const [recentLeads, setRecentLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadDashboard(); }, []);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const [dashRes, leadsRes] = await Promise.all([
        apiFetch('dashboard').catch(() => ({ success: false })),
        apiFetch('leads?limit=8&page=1'),
      ]);
      if (dashRes.success) setDashData(dashRes.data);
      if (leadsRes.success) setRecentLeads(leadsRes.data?.leads || []);
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const stats = dashData?.stats || {};
  const pipeline = dashData?.pipeline || [];
  const leadSources = dashData?.leadSources || [];
  const upcomingFollowups = dashData?.upcomingFollowups || [];
  const projectLeads = dashData?.projectLeads || [];
  const todayActivity = dashData?.todayActivity || {};
  const statuses = masterData?.statuses || [];

  const pipelineData = pipeline.length > 0
    ? pipeline.filter(p => p.count > 0).map(p => ({ stage: p.label || p.name, count: p.count, color: p.color || '#2a5298' }))
    : statuses.slice(0, 8).filter(s => s.count > 0).map(s => ({ stage: s.name, count: s.count || 0, color: s.color || '#2a5298' }));

  const sourceData = leadSources.map(s => ({ source: s.source || 'Unknown', count: s.count || 0 }));
  const totalSourceLeads = sourceData.reduce((s, d) => s + d.count, 0);

  const projectData = projectLeads.filter(p => p.count > 0).slice(0, 8);

  const formatDate = (dt) => {
    if (!dt) return '';
    const d = new Date(dt);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  };
  const formatTime = (dt) => {
    if (!dt) return '';
    const d = new Date(dt);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };
  const timeAgo = (dt) => {
    if (!dt) return '';
    const mins = Math.floor((Date.now() - new Date(dt)) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return formatDate(dt);
  };

  return (
    <div>
      <Header title="Dashboard" subtitle="Business overview & CRM analytics" />

      <div className="page">
        {/* ── Top Stats ── */}
        <div className="dash-stats">
          <StatCard icon={Users} label="Total Leads" value={stats.totalLeads || categoryCounts.total || 0} />
          <StatCard icon={Sparkles} label="Fresh Leads" value={categoryCounts.fresh || 0} accent />
          <StatCard icon={Target} label="Today's Leads" value={stats.todayLeads || 0} />
          <StatCard icon={UserCheck} label="Assigned" value={categoryCounts.assigned || 0} />
          <StatCard icon={UserX} label="Non-Assigned" value={categoryCounts.non_assigned || 0} />
          <StatCard icon={Briefcase} label="Active Brokers" value={stats.activeBrokers || 0} />
        </div>

        {/* ── Today's Activity Strip ── */}
        <div className="dash-activity-strip">
          <div className="dash-activity-item">
            <div className="dash-activity-icon dash-activity-icon--blue"><Zap size={16} /></div>
            <div><span className="dash-activity-val">{todayActivity.newLeads || 0}</span><span className="dash-activity-lbl">New Leads Today</span></div>
          </div>
          <div className="dash-activity-divider" />
          <div className="dash-activity-item">
            <div className="dash-activity-icon dash-activity-icon--orange"><Phone size={16} /></div>
            <div><span className="dash-activity-val">{todayActivity.todayFollowups || 0}</span><span className="dash-activity-lbl">Follow-ups Today</span></div>
          </div>
          <div className="dash-activity-divider" />
          <div className="dash-activity-item">
            <div className="dash-activity-icon dash-activity-icon--green"><Activity size={16} /></div>
            <div><span className="dash-activity-val">{todayActivity.totalActivities || 0}</span><span className="dash-activity-lbl">Activities Today</span></div>
          </div>
          <div className="dash-activity-divider" />
          <div className="dash-activity-item">
            <div className="dash-activity-icon dash-activity-icon--purple"><Building2 size={16} /></div>
            <div><span className="dash-activity-val">{projectData.length}</span><span className="dash-activity-lbl">Active Projects</span></div>
          </div>
        </div>

        {/* ── Charts Row ── */}
        <div className="dash-charts">
          {/* Pipeline */}
          <div className="card">
            <div className="card__header">
              <h3 className="card__title">Lead Pipeline</h3>
              <button className="btn btn--ghost btn--sm" onClick={() => navigate('/leads/status-wise')}>View All <ArrowUpRight size={14} /></button>
            </div>
            <div className="card__body">
              {pipelineData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={pipelineData} barSize={28}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="stage" tick={{ fontSize: 10, fill: '#64748b' }} angle={-20} textAnchor="end" height={50} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {pipelineData.map((entry, i) => (
                        <Cell key={i} fill={entry.color || COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="dash-empty">No pipeline data yet</div>
              )}
            </div>
          </div>

          {/* Source Distribution */}
          <div className="card">
            <div className="card__header">
              <h3 className="card__title">Lead Sources</h3>
            </div>
            <div className="card__body">
              {sourceData.length > 0 ? (
                <div className="dash-sources">
                  <div className="dash-pie">
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={sourceData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="count" paddingAngle={2}>
                          {sourceData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="dash-source-list">
                    {sourceData.map((s, i) => (
                      <div key={i} className="dash-source-row">
                        <div className="dash-source-dot" style={{ background: COLORS[i % COLORS.length] }} />
                        <span className="dash-source-name">{s.source}</span>
                        <span className="dash-source-count">{s.count}</span>
                        <span className="dash-source-pct">{totalSourceLeads > 0 ? Math.round((s.count / totalSourceLeads) * 100) : 0}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="dash-empty">No source data yet</div>
              )}
            </div>
          </div>
        </div>

        {/* ── Project Leads + Followups Row ── */}
        <div className="dash-row-2">
          {/* Project-wise Leads */}
          <div className="card">
            <div className="card__header">
              <h3 className="card__title">Project-wise Leads</h3>
              <button className="btn btn--ghost btn--sm" onClick={() => navigate('/projects')}>Projects <ArrowUpRight size={14} /></button>
            </div>
            <div className="card__body" style={{ padding: 0 }}>
              {projectData.length > 0 ? (
                <div className="dash-project-list">
                  {projectData.map((p, i) => (
                    <div key={p.project_id} className="dash-project-row">
                      <div className="dash-project-rank">{i + 1}</div>
                      <div className="dash-project-info">
                        <span className="dash-project-name">{p.name}</span>
                        <div className="dash-project-bar-bg">
                          <div className="dash-project-bar" style={{ width: `${Math.min(100, (p.count / (projectData[0]?.count || 1)) * 100)}%` }} />
                        </div>
                      </div>
                      <span className="dash-project-count">{p.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="dash-empty">No project leads yet</div>
              )}
            </div>
          </div>

          {/* Upcoming Follow-ups */}
          <div className="card">
            <div className="card__header">
              <h3 className="card__title">Upcoming Follow-ups</h3>
              <button className="btn btn--ghost btn--sm" onClick={() => navigate('/followup/today')}>View All <ArrowUpRight size={14} /></button>
            </div>
            <div className="card__body" style={{ padding: 0 }}>
              {upcomingFollowups.length > 0 ? (
                <div className="dash-followup-list">
                  {upcomingFollowups.map((fu, i) => (
                    <div key={fu.lf_id || i} className="dash-followup-row">
                      <div className="dash-followup-time">
                        <Calendar size={13} />
                        <span>{formatDate(fu.followup_dt)}</span>
                        <Clock size={12} />
                        <span>{formatTime(fu.followup_dt)}</span>
                      </div>
                      <div className="dash-followup-info">
                        <span className="dash-followup-name">{fu.lead_name}</span>
                        {fu.note && <span className="dash-followup-note">{fu.note}</span>}
                      </div>
                      {fu.status_name && (
                        <span className="dash-followup-badge" style={{ color: fu.status_color || '#6b7280', background: (fu.status_color || '#6b7280') + '15' }}>
                          {fu.status_name}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="dash-empty">No upcoming follow-ups</div>
              )}
            </div>
          </div>
        </div>

        {/* ── Recent Leads (full width) ── */}
        <div className="dash-recent">
          <div className="card">
            <div className="card__header">
              <h3 className="card__title">Recent Leads</h3>
              <button className="btn btn--ghost btn--sm" onClick={() => navigate('/leads')}>View All <ArrowUpRight size={14} /></button>
            </div>
            <div className="card__body" style={{ padding: 0 }}>
              {recentLeads.length === 0 ? (
                <div className="dash-empty">{loading ? 'Loading...' : 'No leads yet'}</div>
              ) : (
                <table className="dash-lead-table">
                  <thead>
                    <tr>
                      <th>Lead</th>
                      <th>Contact</th>
                      <th>Source</th>
                      <th>Status</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentLeads.map(lead => (
                      <tr key={lead.l_id} onClick={() => navigate('/leads')} className="dash-lead-row">
                        <td>
                          <div className="dash-lead-cell">
                            <div className="dash-lead-avatar">
                              {(lead.name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                            </div>
                            <span className="dash-lead-name">{lead.name}</span>
                          </div>
                        </td>
                        <td>
                          <span className="dash-lead-contact">{lead.mobile || '-'}</span>
                        </td>
                        <td>
                          <span className="dash-lead-source">{lead.source_name || lead.source_type || '-'}</span>
                        </td>
                        <td>
                          {lead.status_name ? (
                            <span className="dash-lead-status" style={{ color: lead.status_color || '#6b7280', background: (lead.status_color || '#6b7280') + '12' }}>
                              {lead.status_name}
                            </span>
                          ) : <span className="dash-lead-source">-</span>}
                        </td>
                        <td>
                          <span className="dash-lead-time">{timeAgo(lead.create_dt)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
