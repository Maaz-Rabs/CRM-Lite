import React, { useState } from 'react';
import { useCRM } from '../../context/CRMContext';
import Header from '../../components/layout/Header';
import { Button, Badge, Modal, FormInput, FormSelect, StatusBadge, StatCard } from '../../components/common/Common';
import { Plus, Search, Users, UserCheck, TrendingUp, Award, Edit2 } from 'lucide-react';
import './Team.css';

const emptyMember = { name: '', role: '', team: '', email: '', phone: '', status: 'Active', performance: 0, target: '', achieved: '', leads_handled: 0, deals_closed: 0 };

const Team = () => {
  const { teamMembers, addTeamMember, updateTeamMember } = useCRM();
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({ ...emptyMember });
  const [toast, setToast] = useState(null);

  const showNotification = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const teams = [...new Set(teamMembers.map(m => m.team))];
  const filtered = teamMembers.filter(m => {
    const q = search.toLowerCase();
    const matchSearch = !q || m.name.toLowerCase().includes(q) || m.role.toLowerCase().includes(q);
    const matchTeam = teamFilter === 'All' || m.team === teamFilter;
    return matchSearch && matchTeam;
  });

  const handleFormChange = (e) => setFormData(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleAdd = () => {
    // Validation
    if (!formData.name || !formData.name.trim()) {
      showNotification('Name is required', 'error');
      return;
    }
    if (formData.name.trim().length < 2) {
      showNotification('Name must be at least 2 characters', 'error');
      return;
    }
    if (!formData.role) {
      showNotification('Role is required', 'error');
      return;
    }
    if (!formData.team) {
      showNotification('Team is required', 'error');
      return;
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      showNotification('Please enter a valid email', 'error');
      return;
    }

    addTeamMember({ ...formData, name: formData.name.trim(), joined: new Date().toISOString().split('T')[0] });
    showNotification('Team member added successfully', 'success');
    setShowModal(false);
    setFormData({ ...emptyMember });
  };

  const handleEdit = () => {
    if (!selected) return;
    // Validation
    if (!formData.name || !formData.name.trim()) {
      showNotification('Name is required', 'error');
      return;
    }
    if (formData.name.trim().length < 2) {
      showNotification('Name must be at least 2 characters', 'error');
      return;
    }
    if (!formData.role) {
      showNotification('Role is required', 'error');
      return;
    }
    if (!formData.team) {
      showNotification('Team is required', 'error');
      return;
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      showNotification('Please enter a valid email', 'error');
      return;
    }

    updateTeamMember(selected.id, formData);
    showNotification('Team member updated successfully', 'success');
    setShowDetailModal(false);
    setEditMode(false);
  };

  const openDetail = (member) => {
    setSelected(member);
    setFormData({ ...member });
    setEditMode(false);
    setShowDetailModal(true);
  };

  const activeCount = teamMembers.filter(m => m.status === 'Active').length;
  const avgPerf = Math.round(teamMembers.reduce((s, m) => s + m.performance, 0) / teamMembers.length);

  const MemberForm = ({ onSubmit, label }) => (
    <div>
      <div className="form-row">
        <FormInput label="Full Name *" name="name" value={formData.name} onChange={handleFormChange} placeholder="Full name" />
        <FormSelect label="Role" name="role" value={formData.role} onChange={handleFormChange} options={['Team Lead', 'Senior Agent', 'Agent', 'Junior Agent']} />
      </div>
      <div className="form-row">
        <FormInput label="Email" name="email" type="email" value={formData.email} onChange={handleFormChange} />
        <FormInput label="Phone" name="phone" value={formData.phone} onChange={handleFormChange} />
      </div>
      <div className="form-row">
        <FormSelect label="Team" name="team" value={formData.team} onChange={handleFormChange} options={['Sales Team A', 'Sales Team B', 'Sales Team C']} />
        <FormSelect label="Status" name="status" value={formData.status} onChange={handleFormChange} options={['Active', 'On Leave', 'Inactive']} />
      </div>
      <div className="form-row">
        <FormInput label="Target" name="target" value={formData.target} onChange={handleFormChange} placeholder="e.g. 50 L" />
        <FormInput label="Achieved" name="achieved" value={formData.achieved} onChange={handleFormChange} placeholder="e.g. 46 L" />
      </div>
      <div className="modal__actions">
        <Button variant="outline" onClick={() => { setShowModal(false); setShowDetailModal(false); }}>Cancel</Button>
        <Button variant="gold" onClick={onSubmit}>{label}</Button>
      </div>
    </div>
  );

  const getPerformanceColor = (p) => p >= 90 ? '--success' : p >= 70 ? '--gold' : p >= 50 ? '--navy' : '--danger';

  return (
    <div>
      <Header
        title="Team Management"
        subtitle={`${teamMembers.length} team members`}
        actions={<Button variant="gold" icon={Plus} onClick={() => { setFormData({ ...emptyMember }); setShowModal(true); }}>Add Member</Button>}
      />
      <div className="page">
        <div className="page__grid page__grid--stats">
          <StatCard icon={Users} label="Total Members" value={teamMembers.length} />
          <StatCard icon={UserCheck} label="Active Now" value={activeCount} accent />
          <StatCard icon={TrendingUp} label="Avg Performance" value={`${avgPerf}%`} change="5%" changeType="positive" />
          <StatCard icon={Award} label="Top Performer" value="Sara Ali" />
        </div>

        <div className="filter-bar">
          <div className="filter-bar__search">
            <Search size={16} />
            <input placeholder="Search members..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {['All', ...teams].map(t => (
            <button key={t} className={`filter-chip ${teamFilter === t ? 'filter-chip--active' : ''}`} onClick={() => setTeamFilter(t)}>{t}</button>
          ))}
        </div>

        <div className="team-grid">
          {filtered.map(member => (
            <div key={member.id} className="team-card animate-fade-in" onClick={() => openDetail(member)}>
              <div className="team-card__top">
                <div className="avatar avatar--navy" style={{ width: 48, height: 48, fontSize: 16 }}>
                  {member.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="team-card__info">
                  <h3 className="team-card__name">{member.name}</h3>
                  <p className="team-card__role">{member.role}</p>
                </div>
                <StatusBadge status={member.status} />
              </div>
              <div className="team-card__team-badge">
                <Badge variant="primary">{member.team}</Badge>
              </div>
              <div className="team-card__perf">
                <div className="team-card__perf-header">
                  <span>Performance</span>
                  <span style={{ fontWeight: 700, color: 'var(--navy-800)' }}>{member.performance}%</span>
                </div>
                <div className="progress-bar">
                  <div className={`progress-bar__fill progress-bar__fill${getPerformanceColor(member.performance)}`} style={{ width: `${member.performance}%` }} />
                </div>
              </div>
              <div className="team-card__bottom">
                <div className="team-card__metric">
                  <span className="team-card__metric-val">{member.leads_handled}</span>
                  <span className="team-card__metric-label">Leads</span>
                </div>
                <div className="team-card__metric">
                  <span className="team-card__metric-val">{member.deals_closed}</span>
                  <span className="team-card__metric-label">Deals</span>
                </div>
                <div className="team-card__metric">
                  <span className="team-card__metric-val">{member.target}</span>
                  <span className="team-card__metric-label">Target</span>
                </div>
                <div className="team-card__metric">
                  <span className="team-card__metric-val" style={{ color: 'var(--gold-700)' }}>{member.achieved}</span>
                  <span className="team-card__metric-label">Achieved</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Team Member" size="md">
        <MemberForm onSubmit={handleAdd} label="Add Member" />
      </Modal>

      <Modal isOpen={showDetailModal} onClose={() => { setShowDetailModal(false); setEditMode(false); }} title={editMode ? 'Edit Member' : 'Member Details'} size="md">
        {!editMode && selected ? (
          <div>
            <div className="lead-detail__header">
              <div className="avatar avatar--navy" style={{ width: 56, height: 56, fontSize: 20 }}>
                {selected.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div>
                <h3 className="lead-detail__name">{selected.name}</h3>
                <p className="lead-detail__sub">{selected.role} · {selected.team}</p>
              </div>
              <div style={{ marginLeft: 'auto' }}>
                <Button variant="primary" icon={Edit2} size="sm" onClick={() => setEditMode(true)}>Edit</Button>
              </div>
            </div>
            <div className="lead-detail__grid">
              <div className="lead-detail__item"><span className="lead-detail__label">Email</span><span className="lead-detail__value">{selected.email}</span></div>
              <div className="lead-detail__item"><span className="lead-detail__label">Phone</span><span className="lead-detail__value">{selected.phone}</span></div>
              <div className="lead-detail__item"><span className="lead-detail__label">Status</span><StatusBadge status={selected.status} /></div>
              <div className="lead-detail__item"><span className="lead-detail__label">Performance</span><span className="lead-detail__value">{selected.performance}%</span></div>
              <div className="lead-detail__item"><span className="lead-detail__label">Target</span><span className="lead-detail__value">{selected.target}</span></div>
              <div className="lead-detail__item"><span className="lead-detail__label">Achieved</span><span className="lead-detail__value" style={{ color: 'var(--gold-700)', fontWeight: 600 }}>{selected.achieved}</span></div>
              <div className="lead-detail__item"><span className="lead-detail__label">Leads Handled</span><span className="lead-detail__value">{selected.leads_handled}</span></div>
              <div className="lead-detail__item"><span className="lead-detail__label">Deals Closed</span><span className="lead-detail__value">{selected.deals_closed}</span></div>
              <div className="lead-detail__item"><span className="lead-detail__label">Joined</span><span className="lead-detail__value">{selected.joined}</span></div>
            </div>
          </div>
        ) : (
          <MemberForm onSubmit={handleEdit} label="Save Changes" />
        )}
      </Modal>

      {toast?.message && (
        <div className={`toast toast--${toast.type}`} style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          padding: '12px 16px',
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 500,
          zIndex: 9999,
          backgroundColor: toast.type === 'success' ? '#10b981' : '#ef4444',
          color: 'white',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          animation: 'slideIn 0.3s ease-out'
        }}>
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default Team;
