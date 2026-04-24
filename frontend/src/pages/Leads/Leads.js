import React, { useState, useMemo } from 'react';
import { useCRM } from '../../context/CRMContext';
import Header from '../../components/layout/Header';
import { Button, Badge, Table, Modal, FormInput, FormSelect, PriorityBadge, StatusBadge, StatCard } from '../../components/common/Common';
import { mockLeadSources, mockLeadStatuses, mockPropertyTypes, mockLocations } from '../../data/mockData';
import { Plus, Search, Users, Flame, Eye, Trophy, Edit2, Trash2 } from 'lucide-react';
import './Leads.css';

const emptyForm = {
  name: '', phone: '', email: '', source: '', status: 'New', budget: '',
  property_type: '', location: '', assigned_to: '', priority: 'Warm', notes: '', next_followup: ''
};

const Leads = () => {
  const { leads, addLead, updateLead, deleteLead, brokers } = useCRM();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({ ...emptyForm });
  const [toast, setToast] = useState(null);

  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      const q = search.toLowerCase();
      const matchSearch = !q || l.name.toLowerCase().includes(q) || l.phone.includes(q) || l.email.toLowerCase().includes(q) || (l.location || '').toLowerCase().includes(q);
      const matchStatus = statusFilter === 'All' || l.status === statusFilter;
      const matchPriority = priorityFilter === 'All' || l.priority === priorityFilter;
      return matchSearch && matchStatus && matchPriority;
    });
  }, [leads, search, statusFilter, priorityFilter]);

  const stats = useMemo(() => ({
    total: leads.length,
    hot: leads.filter(l => l.priority === 'Hot').length,
    siteVisits: leads.filter(l => l.status === 'Site Visit').length,
    won: leads.filter(l => l.status === 'Won').length,
  }), [leads]);

  const handleFormChange = (e) => setFormData(p => ({ ...p, [e.target.name]: e.target.value }));

  const showNotification = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAddLead = () => {
    const nameTrimed = formData.name.trim();
    const phoneTrimed = formData.phone.trim();
    const emailTrimed = formData.email.trim();

    if (!nameTrimed) {
      showNotification('Lead name is required', 'error');
      return;
    }
    if (nameTrimed.length < 2) {
      showNotification('Lead name must be at least 2 characters', 'error');
      return;
    }
    if (!phoneTrimed) {
      showNotification('Phone number is required', 'error');
      return;
    }
    if (!/^\d{7,15}$/.test(phoneTrimed.replace(/\D/g, ''))) {
      showNotification('Phone number must be 7-15 digits', 'error');
      return;
    }
    if (emailTrimed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimed)) {
      showNotification('Invalid email format', 'error');
      return;
    }

    addLead(formData);
    showNotification('Lead created successfully', 'success');
    setShowAddModal(false);
    setFormData({ ...emptyForm });
  };

  const handleEditLead = () => {
    if (!selectedLead) return;

    const nameTrimed = formData.name.trim();
    const phoneTrimed = formData.phone.trim();
    const emailTrimed = formData.email.trim();

    if (!nameTrimed) {
      showNotification('Lead name is required', 'error');
      return;
    }
    if (nameTrimed.length < 2) {
      showNotification('Lead name must be at least 2 characters', 'error');
      return;
    }
    if (!phoneTrimed) {
      showNotification('Phone number is required', 'error');
      return;
    }
    if (!/^\d{7,15}$/.test(phoneTrimed.replace(/\D/g, ''))) {
      showNotification('Phone number must be 7-15 digits', 'error');
      return;
    }
    if (emailTrimed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimed)) {
      showNotification('Invalid email format', 'error');
      return;
    }

    updateLead(selectedLead.id, formData);
    showNotification('Lead updated successfully', 'success');
    setShowViewModal(false);
    setEditMode(false);
    setSelectedLead(null);
  };

  const handleDeleteLead = (id) => {
    if (window.confirm('Delete this lead?')) {
      deleteLead(id);
      setShowViewModal(false);
    }
  };

  const openViewModal = (lead) => {
    setSelectedLead(lead);
    setFormData({ ...lead });
    setEditMode(false);
    setShowViewModal(true);
  };

  const agentOptions = brokers.filter(b => b.status === 'Active').map(b => ({ value: b.name, label: b.name }));

  const LeadForm = ({ onSubmit, submitLabel }) => (
    <div>
      <div className="form-row">
        <FormInput label="Full Name *" name="name" value={formData.name} onChange={handleFormChange} placeholder="Enter full name" />
        <FormInput label="Phone *" name="phone" value={formData.phone} onChange={handleFormChange} placeholder="+91 or +971" />
      </div>
      <div className="form-row">
        <FormInput label="Email" name="email" type="email" value={formData.email} onChange={handleFormChange} placeholder="email@example.com" />
        <FormSelect label="Source" name="source" value={formData.source} onChange={handleFormChange} options={mockLeadSources} />
      </div>
      <div className="form-row">
        <FormSelect label="Property Type" name="property_type" value={formData.property_type} onChange={handleFormChange} options={mockPropertyTypes} />
        <FormSelect label="Location" name="location" value={formData.location} onChange={handleFormChange} options={mockLocations} />
      </div>
      <div className="form-row">
        <FormInput label="Budget" name="budget" value={formData.budget} onChange={handleFormChange} placeholder="e.g. 1.5 Cr - 2 Cr" />
        <FormSelect label="Priority" name="priority" value={formData.priority} onChange={handleFormChange} options={['Hot', 'Warm', 'Cold']} />
      </div>
      <div className="form-row">
        <FormSelect label="Status" name="status" value={formData.status} onChange={handleFormChange} options={mockLeadStatuses} />
        <FormSelect label="Assign To" name="assigned_to" value={formData.assigned_to} onChange={handleFormChange} options={agentOptions} placeholder="Select agent..." />
      </div>
      <FormInput label="Next Follow-up" name="next_followup" type="date" value={formData.next_followup} onChange={handleFormChange} />
      <div className="form-group">
        <label className="form-label">Notes</label>
        <textarea className="form-input" name="notes" value={formData.notes} onChange={handleFormChange} rows="3" placeholder="Add notes..." style={{ resize: 'vertical', minHeight: '70px' }} />
      </div>
      <div className="modal__actions">
        <Button variant="outline" onClick={() => { setShowAddModal(false); setShowViewModal(false); }}>Cancel</Button>
        <Button variant="gold" onClick={onSubmit}>{submitLabel}</Button>
      </div>
    </div>
  );

  const columns = [
    {
      header: 'Lead', render: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="avatar avatar--navy">{row.name.split(' ').map(n => n[0]).join('')}</div>
          <div>
            <p style={{ fontWeight: 600, color: 'var(--navy-800)', fontSize: '13px' }}>{row.name}</p>
            <p style={{ fontSize: '11px', color: 'var(--gray-500)', marginTop: '2px' }}>{row.email}</p>
          </div>
        </div>
      )
    },
    { header: 'Phone', render: (row) => <span style={{ fontSize: '13px' }}>{row.phone}</span> },
    { header: 'Source', render: (row) => <Badge variant="primary">{row.source}</Badge> },
    { header: 'Property', render: (row) => <span style={{ fontSize: '13px' }}>{row.property_type} · {row.location}</span> },
    { header: 'Budget', render: (row) => <span style={{ fontWeight: 600, color: 'var(--gold-700)', fontSize: '13px' }}>{row.budget}</span> },
    { header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { header: 'Priority', render: (row) => <PriorityBadge priority={row.priority} /> },
    { header: 'Assigned', render: (row) => <span style={{ fontSize: '13px', color: row.assigned_to ? 'var(--gray-700)' : 'var(--gray-400)' }}>{row.assigned_to || 'Unassigned'}</span> },
    {
      header: 'Actions', width: '100px', render: (row) => (
        <div style={{ display: 'flex', gap: '6px' }}>
          <button className="btn btn--ghost btn--sm" onClick={(e) => { e.stopPropagation(); openViewModal(row); }}><Edit2 size={14} /></button>
          <button className="btn btn--ghost btn--sm" onClick={(e) => { e.stopPropagation(); handleDeleteLead(row.id); }} style={{ color: 'var(--danger)' }}><Trash2 size={14} /></button>
        </div>
      )
    }
  ];

  return (
    <div>
      <Header
        title="Leads Management"
        subtitle={`${leads.length} total leads`}
        actions={<Button variant="gold" icon={Plus} onClick={() => { setFormData({ ...emptyForm }); setShowAddModal(true); }}>Add Lead</Button>}
      />

      <div className="page">
        <div className="page__grid page__grid--stats">
          <StatCard icon={Users} label="Total Leads" value={stats.total} change="12%" changeType="positive" />
          <StatCard icon={Flame} label="Hot Leads" value={stats.hot} change="3" changeType="positive" accent />
          <StatCard icon={Eye} label="Site Visits" value={stats.siteVisits} />
          <StatCard icon={Trophy} label="Won Deals" value={stats.won} change="18%" changeType="positive" />
        </div>

        {/* Filter Bar */}
        <div className="filter-bar">
          <div className="filter-bar__search">
            <Search size={16} />
            <input placeholder="Search leads by name, phone, email, location..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {['All', ...mockLeadStatuses].map(s => (
            <button key={s} className={`filter-chip ${statusFilter === s ? 'filter-chip--active' : ''}`} onClick={() => setStatusFilter(s)}>{s}</button>
          ))}
        </div>

        <div className="leads__priority-filters">
          {['All', 'Hot', 'Warm', 'Cold'].map(p => (
            <button key={p} className={`filter-chip ${priorityFilter === p ? 'filter-chip--active' : ''}`} onClick={() => setPriorityFilter(p)}>
              {p === 'Hot' && '🔥 '}{p === 'Warm' && '🌡️ '}{p === 'Cold' && '❄️ '}{p}
            </button>
          ))}
          <span className="leads__count">{filteredLeads.length} leads found</span>
        </div>

        <Table columns={columns} data={filteredLeads} onRowClick={openViewModal} emptyMessage="No leads found matching your filters" />
      </div>

      {/* Add Lead Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add New Lead" size="lg">
        <LeadForm onSubmit={handleAddLead} submitLabel="Add Lead" />
      </Modal>

      {/* View/Edit Lead Modal */}
      <Modal isOpen={showViewModal} onClose={() => { setShowViewModal(false); setEditMode(false); }} title={editMode ? 'Edit Lead' : 'Lead Details'} size="lg">
        {!editMode && selectedLead ? (
          <div className="lead-detail">
            <div className="lead-detail__header">
              <div className="avatar avatar--gold" style={{ width: 56, height: 56, fontSize: 20 }}>
                {selectedLead.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div>
                <h3 className="lead-detail__name">{selectedLead.name}</h3>
                <p className="lead-detail__sub">{selectedLead.property_type} · {selectedLead.location}</p>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                <Button variant="primary" icon={Edit2} size="sm" onClick={() => setEditMode(true)}>Edit</Button>
                <Button variant="danger" icon={Trash2} size="sm" onClick={() => handleDeleteLead(selectedLead.id)}>Delete</Button>
              </div>
            </div>
            <div className="lead-detail__grid">
              <div className="lead-detail__item"><span className="lead-detail__label">Phone</span><span className="lead-detail__value">{selectedLead.phone}</span></div>
              <div className="lead-detail__item"><span className="lead-detail__label">Email</span><span className="lead-detail__value">{selectedLead.email}</span></div>
              <div className="lead-detail__item"><span className="lead-detail__label">Source</span><Badge variant="primary">{selectedLead.source}</Badge></div>
              <div className="lead-detail__item"><span className="lead-detail__label">Status</span><StatusBadge status={selectedLead.status} /></div>
              <div className="lead-detail__item"><span className="lead-detail__label">Priority</span><PriorityBadge priority={selectedLead.priority} /></div>
              <div className="lead-detail__item"><span className="lead-detail__label">Budget</span><span className="lead-detail__value" style={{ color: 'var(--gold-700)', fontWeight: 600 }}>{selectedLead.budget}</span></div>
              <div className="lead-detail__item"><span className="lead-detail__label">Assigned To</span><span className="lead-detail__value">{selectedLead.assigned_to || 'Unassigned'}</span></div>
              <div className="lead-detail__item"><span className="lead-detail__label">Created</span><span className="lead-detail__value">{selectedLead.created_at}</span></div>
              <div className="lead-detail__item"><span className="lead-detail__label">Next Follow-up</span><span className="lead-detail__value">{selectedLead.next_followup || '-'}</span></div>
              <div className="lead-detail__item"><span className="lead-detail__label">Last Follow-up</span><span className="lead-detail__value">{selectedLead.last_followup || '-'}</span></div>
            </div>
            {selectedLead.notes && (
              <div className="lead-detail__notes">
                <span className="lead-detail__label">Notes</span>
                <p className="lead-detail__notes-text">{selectedLead.notes}</p>
              </div>
            )}
          </div>
        ) : (
          <LeadForm onSubmit={handleEditLead} submitLabel="Save Changes" />
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

export default Leads;