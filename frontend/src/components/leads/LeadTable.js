import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCRM } from '../../context/CRMContext';
import { apiFetch, getFileUrl } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import { Button, Modal, PriorityBadge } from '../common/Common';
import { Trash2, Eye, Phone, Mail, Zap, UserCheck, Download, ChevronLeft, ChevronRight, X, PhoneCall, Send, Share2, MessageSquare, Calendar, ArrowUpCircle, Clock, CheckCircle, Settings2, GripVertical, EyeOff, Lock, Unlock, Repeat, Pencil, FileText, ExternalLink } from 'lucide-react';
import './LeadTable.css';

const ROWS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

const ALL_COLUMNS = [
  { id: 'lead', label: 'Lead', fixed: true },
  { id: 'contact', label: 'Contact' },
  { id: 'source', label: 'Source' },
  { id: 'status', label: 'Status' },
  { id: 'assigned', label: 'Assigned To' },
  { id: 'assigned_by', label: 'Assigned By' },
  { id: 'followup', label: 'Follow-up' },
  { id: 'budget', label: 'Budget' },
  { id: 'comments', label: 'Comments' },
  { id: 'priority', label: 'Priority' },
  { id: 'project', label: 'Project' },
  { id: 'location', label: 'Location' },
  { id: 'created_by', label: 'Created By' },
  { id: 'date', label: 'Date' },
  { id: 'actions', label: 'Actions', fixed: true },
];

const DEFAULT_VISIBLE = ['lead', 'contact', 'source', 'status', 'assigned', 'assigned_by', 'followup', 'budget', 'comments', 'created_by', 'date', 'actions'];
const STORAGE_KEY = 'leadTableColumns';

const leadTypeColors = {
  fresh: { color: '#e6197a', bg: 'rgba(230, 25, 122, 0.04)', label: 'Fresh', border: 'rgba(230, 25, 122, 0.15)' },
  imported: { color: '#1d4ed8', bg: 'rgba(29, 78, 216, 0.04)', label: 'Imported', border: 'rgba(29, 78, 216, 0.15)' },
  reset: { color: '#6b7280', bg: 'rgba(107, 114, 128, 0.04)', label: 'Reset', border: 'rgba(107, 114, 128, 0.15)' },
};

const StatusBadge = ({ name, color }) => {
  if (!name) return <span className="lead-table__status-na">—</span>;
  const c = color || '#6b7280';
  return (
    <span className="lead-status-badge" style={{
      color: c,
      background: c + '12',
      borderLeft: `3px solid ${c}`,
    }}>
      {name}
    </span>
  );
};

const LeadTypeBadge = ({ type }) => {
  const config = leadTypeColors[type] || leadTypeColors.fresh;
  return (
    <span className="lead-type-badge" style={{ color: config.color, background: config.bg, borderColor: config.color + '30' }}>
      <span className="lead-type-badge__dot" style={{ background: config.color }} />
      {config.label}
    </span>
  );
};

// ── Helpers ─────────────────────────────────────────────
const getInitials = (name) => {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

const formatDate = (dt) => {
  if (!dt) return '-';
  const d = new Date(dt);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatBudget = (val) => {
  const n = Number(val);
  if (!n) return '0';
  if (n >= 10000000) return (n / 10000000).toFixed(1).replace(/\.0$/, '') + ' Cr';
  if (n >= 100000) return (n / 100000).toFixed(1).replace(/\.0$/, '') + ' L';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + ' K';
  return n.toString();
};

const getAssignedNames = (lead) => {
  if (Array.isArray(lead.assignments) && lead.assignments.length > 0) {
    return lead.assignments.map(a => a.assigned_to_name).filter(Boolean).join(', ');
  }
  if (lead.assigned_users && Array.isArray(lead.assigned_users) && lead.assigned_users.length > 0) {
    return lead.assigned_users.map(u => u.name || u.username).join(', ');
  }
  // Sometimes backend returns as comma-separated string
  if (typeof lead.assigned_users === 'string' && lead.assigned_users) {
    return lead.assigned_users;
  }
  return null;
};

const callLead = (phone) => { window.open('tel:' + (phone || '').replace(/\s/g, ''), '_self'); };

const emailLead = (lead) => {
  if (!lead.email) return;
  const subject = encodeURIComponent('Following up on your inquiry');
  const body = encodeURIComponent(`Hi ${lead.name},\n\nThank you for your interest.\n\nWarm regards`);
  window.open('mailto:' + lead.email + '?subject=' + subject + '&body=' + body);
};

const shareLead = async (lead) => {
  const text = `Lead: ${lead.name}\nPhone: ${lead.mobile || ''}\nEmail: ${lead.email || ''}\nSource: ${lead.source_name || ''}`;
  if (navigator.share) {
    try { await navigator.share({ title: 'Lead: ' + lead.name, text }); } catch (_) { }
  } else {
    await navigator.clipboard.writeText(text);
    alert('Lead details copied!');
  }
};

const exportToCSV = (leads) => {
  const headers = ['Name', 'Mobile', 'Email', 'Source', 'Status', 'Priority', 'Assigned To', 'Created'];
  const rows = leads.map(l => [
    l.name, l.mobile, l.email, l.source_name, l.status_name,
    l.priority_name, getAssignedNames(l) || 'Unassigned', formatDate(l.create_dt),
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => '"' + (v || '').toString().replace(/"/g, '""') + '"').join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'leads_export.csv'; a.click();
  URL.revokeObjectURL(url);
};

const LeadTable = ({
  leads = [],
  loading = false,
  pagination = {},
  onPageChange,
  onRefresh,
  showLeadType = true,
  emptyMessage = 'No leads found',
  pageAccentColor = null,
}) => {
  const { deleteLead, updateLeadStatus, updateLeadPriority, assignLead, fetchUsers, masterData, addComment, addFollowup, lockLead, transferLeads } = useCRM();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);

  const [sortField, setSortField] = useState('create_dt');
  const [sortDir, setSortDir] = useState('desc');
  const [selectedLeads, setSelectedLeads] = useState([]);

  const [showQuickEdit, setShowQuickEdit] = useState(false);
  const [quickEditLead, setQuickEditLead] = useState(null);
  const [quickEditData, setQuickEditData] = useState({});
  const [quickEditTimeline, setQuickEditTimeline] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineExpanded, setTimelineExpanded] = useState(false);

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignUsers, setAssignUsers] = useState([]);
  const [bulkUserIds, setBulkUserIds] = useState([]);
  const [bulkStatusId, setBulkStatusId] = useState('');
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferUserIds, setTransferUserIds] = useState([]);
  const [transferStatusId, setTransferStatusId] = useState('');

  // View modal detail data
  const [viewDetail, setViewDetail] = useState(null);
  const [viewTimeline, setViewTimeline] = useState([]);
  const [viewLoading, setViewLoading] = useState(false);

  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, id: null, name: '' });
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [columnOrder, setColumnOrder] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) { }
    return DEFAULT_VISIBLE;
  });
  const [dragIdx, setDragIdx] = useState(null);

  const visibleColumns = useMemo(() => {
    return columnOrder.map(id => ALL_COLUMNS.find(c => c.id === id)).filter(Boolean);
  }, [columnOrder]);

  const saveColumns = (newOrder) => {
    setColumnOrder(newOrder);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newOrder));
  };

  const toggleColumn = (colId) => {
    const col = ALL_COLUMNS.find(c => c.id === colId);
    if (col?.fixed) return;
    if (columnOrder.includes(colId)) {
      saveColumns(columnOrder.filter(id => id !== colId));
    } else {
      // Insert before 'actions'
      const idx = columnOrder.indexOf('actions');
      const newOrder = [...columnOrder];
      if (idx >= 0) newOrder.splice(idx, 0, colId);
      else newOrder.push(colId);
      saveColumns(newOrder);
    }
  };

  const moveColumn = (fromIdx, toIdx) => {
    if (fromIdx === toIdx) return;
    const newOrder = [...columnOrder];
    const [moved] = newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, moved);
    saveColumns(newOrder);
  };

  const resetColumns = () => {
    saveColumns([...DEFAULT_VISIBLE]);
  };


  const statuses = masterData?.statuses || [];
  const priorities = masterData?.priorities || [];

  const getLeadType = (lead) => {
    if (lead.source_type === 'import') return 'imported';
    if (!lead.is_viewed) return 'fresh';
    return null;
  };

  const getNameColor = (lead) => {
    if (pageAccentColor) return pageAccentColor;
    const type = getLeadType(lead);
    const c = leadTypeColors[type];
    return c ? c.color : 'var(--navy-800)';
  };

  const getRowBorderColor = (lead) => {
    const type = getLeadType(lead);
    const c = leadTypeColors[type];
    return c ? c.border : 'transparent';
  };

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const sortedLeads = useMemo(() => [...leads].sort((a, b) => {
    let av = (a[sortField] || '').toString().toLowerCase();
    let bv = (b[sortField] || '').toString().toLowerCase();
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  }), [leads, sortField, sortDir]);

  // Use server pagination if available
  const currentPage = pagination?.page || 1;
  const totalItems = pagination?.total || leads.length;
  const totalPages = pagination?.totalPages || pagination?.pages || Math.max(1, Math.ceil(leads.length / rowsPerPage));
  const pagedLeads = pagination?.total ? sortedLeads : sortedLeads.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const allPageSelected = pagedLeads.length > 0 && pagedLeads.every(l => selectedLeads.includes(l.l_id));

  const toggleSelect = (id, e) => {
    e.stopPropagation();
    setSelectedLeads(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const toggleSelectAll = (e) => {
    e.stopPropagation();
    if (allPageSelected) setSelectedLeads(prev => prev.filter(id => !pagedLeads.find(l => l.l_id === id)));
    else setSelectedLeads(prev => [...new Set([...prev, ...pagedLeads.map(l => l.l_id)])]);
  };
  const clearSelection = () => setSelectedLeads([]);

  const openView = async (lead) => {
    setSelectedLead(lead);
    setShowViewModal(true);
    setViewLoading(true);
    try {
      const res = await apiFetch(`leads/${lead.l_id}`);
      if (res.success) {
        setViewDetail(res.data?.lead || lead);
        setViewTimeline(res.data?.lead?.activities || []);
      }
    } catch (err) {}
    setViewLoading(false);
  };

  const handleDelete = (id, name) => {
    setDeleteConfirm({ show: true, id, name: name || 'this lead' });
  };
  const confirmDelete = async () => {
    await deleteLead(deleteConfirm.id);
    setDeleteConfirm({ show: false, id: null, name: '' });
    setShowViewModal(false);
    showToast('Lead deleted successfully');
    onRefresh?.();
  };

  // Quick edit
  const openQuickEdit = async (lead, e) => {
    e.stopPropagation();
    setQuickEditLead(lead);
    setQuickEditData({ ls_id: lead.ls_id || '', lp_id: lead.lp_id || '', comment: '', setFollowup: 'no', followup_dt: '' });
    setQuickEditTimeline([]);
    setTimelineExpanded(false);
    setShowQuickEdit(true);
    fetchTimeline(lead.l_id);
  };

  const fetchTimeline = async (leadId) => {
    setTimelineLoading(true);
    try {
      const res = await apiFetch(`leads/${leadId}`);
      if (res.success && res.data?.lead?.activities) {
        setQuickEditTimeline(res.data.lead.activities);
      }
    } catch (err) {}
    setTimelineLoading(false);
  };

  const handleQuickEditSave = async () => {
    if (!quickEditLead) return;
    let changed = false;
    if (quickEditData.ls_id && quickEditData.ls_id !== quickEditLead.ls_id) {
      await updateLeadStatus(quickEditLead.l_id, quickEditData.ls_id);
      changed = true;
    }
    if (quickEditData.lp_id && quickEditData.lp_id !== quickEditLead.lp_id) {
      await updateLeadPriority(quickEditLead.l_id, quickEditData.lp_id);
      changed = true;
    }
    if (quickEditData.comment?.trim()) {
      await addComment(quickEditLead.l_id, quickEditData.comment.trim());
      changed = true;
    }
    if (quickEditData.setFollowup === 'yes' && quickEditData.followup_dt) {
      await addFollowup(quickEditLead.l_id, { followup_dt: quickEditData.followup_dt, note: '' });
      changed = true;
    }
    if (changed) {
      setQuickEditData(p => ({ ...p, comment: '', setFollowup: 'no', followup_dt: '' }));
      setQuickEditLead(prev => ({ ...prev, ls_id: quickEditData.ls_id, lp_id: quickEditData.lp_id }));
      fetchTimeline(quickEditLead.l_id);
      showToast('Lead updated successfully');
      onRefresh?.();
    }
  };
  const handleQuickChange = (e) => setQuickEditData(p => ({ ...p, [e.target.name]: e.target.value }));

  // Bulk assign
  const openBulkAssign = async () => {
    setBulkStatusId('');
    setShowAssignModal(true);
    const res = await fetchUsers();
    const users = res.success ? (Array.isArray(res.data) ? res.data : res.data?.users || []) : [];
    if (res.success) setAssignUsers(users);

    const selectedLeadObjs = leads.filter(l => selectedLeads.includes(l.l_id));
    const preChecked = new Set();
    selectedLeadObjs.forEach(l => {
      if (l.assigned_uids) {
        String(l.assigned_uids).split(',').forEach(uid => {
          const n = Number(uid);
          if (n) preChecked.add(n);
        });
      } else if (l.assigned_users && users.length) {
        const names = String(l.assigned_users).split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
        users.forEach(u => {
          const uname = (u.username || u.name || '').toLowerCase();
          if (uname && names.includes(uname)) preChecked.add(u.u_id);
        });
      }
    });
    setBulkUserIds([...preChecked]);
  };
  const toggleBulkUser = (uid) => {
    setBulkUserIds(prev => prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]);
  };
  const handleBulkAssign = async () => {
    if (bulkUserIds.length === 0) return;
    for (const id of selectedLeads) {
      await assignLead(id, bulkUserIds.map(Number));
      if (bulkStatusId) await updateLeadStatus(id, bulkStatusId);
    }
    setShowAssignModal(false);
    setBulkUserIds([]);
    setBulkStatusId('');
    clearSelection();
    showToast(`${selectedLeads.length} leads assigned successfully`);
    onRefresh?.();
  };

  // Lock/Unlock
  const handleLock = async (lead, e) => {
    e.stopPropagation();
    const res = await lockLead(lead.l_id);
    if (res.success) {
      showToast(res.message || (lead.is_locked ? 'Lead unlocked' : 'Lead locked'));
      onRefresh?.();
    }
  };

  // Transfer
  const openTransfer = async () => {
    setTransferUserIds([]);
    setTransferStatusId('');
    setShowTransferModal(true);
    const res = await fetchUsers();
    if (res.success) setAssignUsers(Array.isArray(res.data) ? res.data : res.data?.users || []);
  };
  const handleTransfer = async () => {
    if (transferUserIds.length === 0) return;
    await transferLeads(selectedLeads, transferUserIds.map(Number), transferStatusId || null);
    setShowTransferModal(false);
    clearSelection();
    showToast(`${selectedLeads.length} leads transferred successfully`);
    onRefresh?.();
  };

  const handlePageChange = (newPage) => {
    if (onPageChange) onPageChange(newPage, rowsPerPage);
  };

  if (loading) {
    return (
      <div className="lead-table-empty">
        <div className="lead-table-empty__icon" style={{ animation: 'spin 1s linear infinite' }}>⏳</div>
        <p>Loading leads...</p>
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <div className="lead-table-empty">
        <div className="lead-table-empty__icon">📋</div>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  const pageNums = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
    .reduce((acc, p, idx, arr) => { if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...'); acc.push(p); return acc; }, []);

  return (
    <>
      {/* Bulk Toolbar */}
      {selectedLeads.length > 0 && (
        <div className="bulk-toolbar">
          <div className="bulk-toolbar__left">
            <button className="bulk-toolbar__clear" onClick={clearSelection} title="Clear selection"><X size={14} /></button>
            <span className="bulk-toolbar__count"><strong>{selectedLeads.length}</strong> leads selected</span>
          </div>
          <div className="bulk-toolbar__actions">
            <button className="bulk-toolbar__btn bulk-toolbar__btn--assign" onClick={openBulkAssign}>
              <UserCheck size={15} /> Assign
            </button>
            <button className="bulk-toolbar__btn bulk-toolbar__btn--transfer" onClick={openTransfer}>
              <Repeat size={15} /> Transfer
            </button>
            <button className="bulk-toolbar__btn bulk-toolbar__btn--call" onClick={() => shareLead(leads.filter(l => selectedLeads.includes(l.l_id))[0])}>
              <Share2 size={15} /> Share
            </button>
            <button className="bulk-toolbar__btn bulk-toolbar__btn--export" onClick={() => exportToCSV(leads.filter(l => selectedLeads.includes(l.l_id)))}>
              <Download size={15} /> Export
            </button>
          </div>
        </div>
      )}

      <div className="lead-table-wrapper">
        {/* Top Bar */}
        <div className="lead-table-top">
          <span className="lead-table-count">
            {totalItems} leads found
            {selectedLeads.length > 0 && <span className="lead-table-selected"> &middot; {selectedLeads.length} selected</span>}
          </span>
          <div className="lead-table-top__right">
            <button className="tbl-export-btn" onClick={() => exportToCSV(leads)}>
              <Download size={13} /> Export All
            </button>
            <button className="tbl-col-btn" onClick={() => setShowColumnSettings(true)} title="Customize Columns">
              <Settings2 size={14} /> Columns
            </button>
            <div className="lead-table-sort">
              <span className="lead-table-sort__label">Sort by:</span>
              <select value={sortField} onChange={e => { setSortField(e.target.value); }} className="lead-table-sort__select">
                <option value="create_dt">Date Added</option>
                <option value="name">Name</option>
                <option value="priority_name">Priority</option>
              </select>
              <button className="lead-table-sort__dir" onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}>
                {sortDir === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <table className="lead-table">
          <thead>
            <tr>
              <th style={{ width: 40, paddingRight: 0 }}>
                <input type="checkbox" className="lead-table__checkbox" checked={allPageSelected} onChange={toggleSelectAll} title="Select page" />
              </th>
              <th style={{ width: 50 }}>#</th>
              <th style={{ width: 160 }}>Actions</th>
              {visibleColumns.filter(c => c.id !== 'actions').map(col => {
                if (col.id === 'lead') return <th key={col.id} onClick={() => handleSort('name')} className="lead-table__th--sortable">Lead {sortField === 'name' && (sortDir === 'asc' ? '↑' : '↓')}</th>;
                if (col.id === 'date') return <th key={col.id} onClick={() => handleSort('create_dt')} className="lead-table__th--sortable">Date {sortField === 'create_dt' && (sortDir === 'asc' ? '↑' : '↓')}</th>;
                return <th key={col.id}>{col.label}</th>;
              })}
            </tr>
          </thead>
          <tbody>
            {pagedLeads.map((lead, idx) => {
              const assignedNames = getAssignedNames(lead);
              return (
                <tr
                  key={lead.l_id}
                  className={'lead-table__row' + (selectedLeads.includes(lead.l_id) ? ' lead-table__row--selected' : '')}
                  style={{ '--row-accent': getNameColor(lead), '--row-border': getRowBorderColor(lead) }}
                  onClick={() => openView(lead)}
                >
                  <td style={{ paddingRight: 0 }} onClick={e => e.stopPropagation()}>
                    <input type="checkbox" className="lead-table__checkbox" checked={selectedLeads.includes(lead.l_id)} onChange={(e) => toggleSelect(lead.l_id, e)} />
                  </td>
                  <td className="lead-table__sr" style={{ color: 'var(--gray-500)', fontWeight: 600 }}>
                    {(currentPage - 1) * rowsPerPage + idx + 1}
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <div className="lead-table__inline-actions">
                      <button className="lt-action lt-action--call" onClick={() => callLead(lead.mobile)} title="Call"><PhoneCall size={15} /></button>
                      <button className="lt-action lt-action--email" onClick={() => emailLead(lead)} title="Email"><Send size={15} /></button>
                      <button className="lt-action lt-action--share" onClick={() => shareLead(lead)} title="Share"><Share2 size={15} /></button>
                      <button className="lt-action lt-action--quick" onClick={(e) => openQuickEdit(lead, e)} title="Quick Edit"><Zap size={15} /></button>
                      <button className="lt-action lt-action--edit" onClick={(e) => { e.stopPropagation(); navigate(`/leads/edit/${lead.l_id}`); }} title="Edit Lead"><Pencil size={15} /></button>
                      <button className="lt-action lt-action--lock" onClick={(e) => handleLock(lead, e)} title={lead.is_locked ? 'Unlock' : 'Lock'}>
                        {lead.is_locked ? <Unlock size={15} /> : <Lock size={15} />}
                      </button>
                      <button className="lt-action lt-action--delete" onClick={() => handleDelete(lead.l_id, lead.name)} title="Delete"><Trash2 size={15} /></button>
                    </div>
                  </td>
                  {visibleColumns.filter(c => c.id !== 'actions').map(col => {
                    switch (col.id) {
                      case 'lead': return (
                        <td key={col.id}>
                          <div className="lead-table__lead-cell">
                            <div className="lead-table__avatar" style={{ borderColor: getNameColor(lead), color: getNameColor(lead) }}>{getInitials(lead.name)}</div>
                            <div>
                              <span className="lead-table__name" style={{ color: getNameColor(lead) }}>{lead.name}</span>
                              {showLeadType && getLeadType(lead) && <div style={{ marginTop: 2 }}><LeadTypeBadge type={getLeadType(lead)} /></div>}
                            </div>
                          </div>
                        </td>
                      );
                      case 'contact': return (
                        <td key={col.id}>
                          <div className="lead-table__contact">
                            <span className="lead-table__phone"><Phone size={11} /> {lead.country_code} {lead.mobile}</span>
                            {lead.email && <span className="lead-table__email"><Mail size={11} /> {lead.email}</span>}
                          </div>
                        </td>
                      );
                      case 'source': return <td key={col.id}><span className="lead-source-chip">{lead.source_name || lead.source_type || '-'}</span></td>;
                      case 'status': return <td key={col.id}><StatusBadge name={lead.status_name} color={lead.status_color} /></td>;
                      case 'assigned': return (
                        <td key={col.id}>
                          <span className={'lead-table__assigned' + (!assignedNames ? ' lead-table__assigned--none' : '')}>{assignedNames || 'Unassigned'}</span>
                        </td>
                      );
                      case 'assigned_by': return (
                        <td key={col.id}>
                          <span className={'lead-table__assigned' + (!lead.assigned_by_users ? ' lead-table__assigned--none' : '')}>{lead.assigned_by_users || '-'}</span>
                        </td>
                      );
                      case 'followup': return (
                        <td key={col.id}>
                          {lead.next_followup_dt ? (
                            <span className={`lead-table__followup${new Date(lead.next_followup_dt) < new Date() ? ' lead-table__followup--missed' : ''}`}>
                              {new Date(lead.next_followup_dt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                              <span className="lead-table__followup-time">{new Date(lead.next_followup_dt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                            </span>
                          ) : <span className="lead-table__muted">-</span>}
                        </td>
                      );
                      case 'budget': return (
                        <td key={col.id}>
                          {(lead.min_budget || lead.max_budget) ? (
                            <span className="lead-table__budget">
                              {lead.budget_currency === 'INR' ? '₹' : lead.budget_currency === 'AED' ? 'د.إ' : '$'}
                              {lead.min_budget ? formatBudget(lead.min_budget) : '0'}{lead.max_budget ? ` - ${formatBudget(lead.max_budget)}` : ''}
                            </span>
                          ) : <span className="lead-table__muted">-</span>}
                        </td>
                      );
                      case 'comments': return (
                        <td key={col.id}>
                          {lead.all_comments ? (() => {
                            const comments = lead.all_comments.split('||').filter(Boolean);
                            const latest = comments[0];
                            return (
                              <div className="lead-table__comment-wrap">
                                <span className="lead-table__comment">
                                  {latest.length > 25 ? latest.substring(0, 25) + '...' : latest}
                                  {comments.length > 1 && <span className="lead-table__comment-count">{comments.length}</span>}
                                </span>
                                <div className="lead-table__comment-tooltip">
                                  <div className="lead-table__comment-tooltip-title">All Comments ({comments.length})</div>
                                  {comments.map((c, i) => <div key={i} className="lead-table__comment-tooltip-item">{c}</div>)}
                                </div>
                              </div>
                            );
                          })() : <span className="lead-table__muted">-</span>}
                        </td>
                      );
                      case 'priority': return (
                        <td key={col.id}>
                          {lead.priority_name ? <PriorityBadge priority={lead.priority_name} /> : <span className="lead-table__muted">-</span>}
                        </td>
                      );
                      case 'project': return (
                        <td key={col.id}>
                          <span className="lead-table__project">{lead.project_names || '-'}</span>
                        </td>
                      );
                      case 'location': return (
                        <td key={col.id}>
                          <span className="lead-table__location">{[lead.city, lead.state].filter(Boolean).join(', ') || '-'}</span>
                        </td>
                      );
                      case 'created_by': return <td key={col.id}><span className="lead-table__created-by">{lead.created_by_name || '-'}</span></td>;
                      case 'date': return <td key={col.id}><span className="lead-table__date">{formatDate(lead.create_dt)}</span></td>;
                      default: return <td key={col.id}>-</td>;
                    }
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="pagination">
          <div className="pagination__info">
            Showing <strong>{Math.min((currentPage - 1) * rowsPerPage + 1, totalItems)}</strong>–<strong>{Math.min(currentPage * rowsPerPage, totalItems)}</strong> of <strong>{totalItems}</strong>
          </div>
          <div className="pagination__controls">
            <select
              className="pagination__per-page"
              value={rowsPerPage}
              onChange={e => {
                const newLimit = Number(e.target.value);
                setRowsPerPage(newLimit);
                if (onPageChange) onPageChange(1, newLimit);
              }}
            >
              {ROWS_PER_PAGE_OPTIONS.map(n => <option key={n} value={n}>{n} / page</option>)}
            </select>
            <button className="pagination__btn" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>
              <ChevronLeft size={15} />
            </button>
            {pageNums.map((p, i) =>
              p === '...'
                ? <span key={'dots' + i} className="pagination__dots">...</span>
                : <button key={p} className={'pagination__btn pagination__btn--num' + (currentPage === p ? ' pagination__btn--active' : '')} onClick={() => handlePageChange(p)}>{p}</button>
            )}
            <button className="pagination__btn" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}>
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Column Settings Modal */}
      <Modal isOpen={showColumnSettings} onClose={() => setShowColumnSettings(false)} title="Customize Columns" size="sm">
        <div className="col-modal">
          <div className="col-modal__section">
            <div className="col-modal__section-header">
              <span className="col-modal__section-title">Visible Columns</span>
              <button className="col-settings-reset" onClick={resetColumns}>Reset Default</button>
            </div>
            <div className="col-modal__list">
              {columnOrder.map((colId, idx) => {
                const col = ALL_COLUMNS.find(c => c.id === colId);
                if (!col) return null;
                return (
                  <div
                    key={colId}
                    className={`col-modal__item${col.fixed ? ' col-modal__item--fixed' : ''}${dragIdx === idx ? ' col-modal__item--dragging' : ''}`}
                    draggable={!col.fixed}
                    onDragStart={() => setDragIdx(idx)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => { if (dragIdx !== null) { moveColumn(dragIdx, idx); setDragIdx(null); } }}
                    onDragEnd={() => setDragIdx(null)}
                  >
                    <span className="col-modal__num">{idx + 1}</span>
                    {!col.fixed && <GripVertical size={14} className="col-modal__grip" />}
                    <span className="col-modal__label">{col.label}</span>
                    {col.fixed ? (
                      <span className="col-modal__fixed-tag">Fixed</span>
                    ) : (
                      <button className="col-modal__remove" onClick={() => toggleColumn(colId)}><EyeOff size={14} /></button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          {ALL_COLUMNS.filter(c => !columnOrder.includes(c.id) && !c.fixed).length > 0 && (
            <div className="col-modal__section">
              <span className="col-modal__section-title">Hidden Columns</span>
              <div className="col-modal__hidden-list">
                {ALL_COLUMNS.filter(c => !columnOrder.includes(c.id) && !c.fixed).map(col => (
                  <button key={col.id} className="col-modal__add-btn" onClick={() => toggleColumn(col.id)}>
                    <Eye size={13} /> {col.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* View Modal - Full Lead Detail */}
      <Modal isOpen={showViewModal} onClose={() => { setShowViewModal(false); setViewDetail(null); setViewTimeline([]); }} title="Lead Details" size="lg">
        {selectedLead && (() => {
          const lead = viewDetail || selectedLead;
          return (
            <div className="lead-view__layout">
              {/* Left column */}
              <div className="lead-view__main">

                {/* Identity header */}
                <div className="lead-view__header">
                  <div className="lead-view__avatar" style={{ background: getNameColor(lead) + '18', borderColor: getNameColor(lead) + '40', color: getNameColor(lead) }}>
                    {getInitials(lead.name)}
                  </div>
                  <div className="lead-view__identity">
                    <div className="lead-view__identity-top">
                      <h3 className="lead-view__name">
                        {lead.name}
                        {lead.is_locked ? <Lock size={14} className="lead-view__lock-icon" /> : null}
                      </h3>
                      <div className="lead-view__contact-actions">
                        <button className="lead-view__icon-btn lead-view__icon-btn--call lt-action lt-action--call" onClick={() => callLead(lead.mobile)} title="Call"><PhoneCall size={15} /></button>
                        <button className="lead-view__icon-btn lead-view__icon-btn--email lt-action lt-action--email" onClick={() => emailLead(lead)} title="Email"><Send size={15} /></button>
                        <button className="lead-view__icon-btn lead-view__icon-btn--share lt-action lt-action--share" onClick={() => shareLead(lead)} title="Share"><Share2 size={15} /></button>
                      </div>
                    </div>
                    <p className="lead-view__sub">
                      {lead.source_name || lead.source_type || ''}
                      {lead.project_names ? ' · ' + lead.project_names : ''}
                    </p>
                    <div className="lead-view__badges">
                      {getLeadType(lead) && <LeadTypeBadge type={getLeadType(lead)} />}
                      <StatusBadge name={lead.status_name} color={lead.status_color} />
                      {lead.priority_name && <PriorityBadge priority={lead.priority_name} />}
                    </div>
                  </div>
                </div>

                {/* Section: Contact */}
                <div className="lead-view__section">
                  <h4 className="lead-view__section-title">Contact</h4>
                  <div className="lead-view__fields">
                    <div className="lead-view__field">
                      <span className="lead-view__field-label"><Phone size={11} /> Phone</span>
                      <span className="lead-view__field-value">{lead.country_code ? lead.country_code + ' ' : ''}{lead.mobile || '—'}</span>
                    </div>
                    <div className="lead-view__field">
                      <span className="lead-view__field-label"><Mail size={11} /> Email</span>
                      <span className="lead-view__field-value">{lead.email || '—'}</span>
                    </div>
                    {lead.alt_mobile && (
                      <div className="lead-view__field">
                        <span className="lead-view__field-label"><Phone size={11} /> Alt Phone</span>
                        <span className="lead-view__field-value">{lead.alt_mobile}</span>
                      </div>
                    )}
                    {lead.alt_email && (
                      <div className="lead-view__field">
                        <span className="lead-view__field-label"><Mail size={11} /> Alt Email</span>
                        <span className="lead-view__field-value">{lead.alt_email}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Section: Requirement */}
                <div className="lead-view__section">
                  <h4 className="lead-view__section-title">Requirement</h4>
                  <div className="lead-view__fields">
                    <div className="lead-view__field">
                      <span className="lead-view__field-label">Buyer Type</span>
                      <span className="lead-view__field-value">{lead.buyer_type || '—'}</span>
                    </div>
                    <div className="lead-view__field">
                      <span className="lead-view__field-label">Investment</span>
                      <span className="lead-view__field-value">{lead.investment_type || '—'}</span>
                    </div>
                    {lead.project_names && (
                      <div className="lead-view__field">
                        <span className="lead-view__field-label">Project</span>
                        <span className="lead-view__field-value">{lead.project_names}</span>
                      </div>
                    )}
                    {(lead.min_budget || lead.max_budget) && (
                      <div className="lead-view__field">
                        <span className="lead-view__field-label">Budget</span>
                        <span className="lead-view__field-value lead-view__field-value--budget">{lead.budget_currency === 'INR' ? '₹' : '$'}{lead.min_budget ? formatBudget(lead.min_budget) : '0'}{lead.max_budget ? ` – ${formatBudget(lead.max_budget)}` : ''}</span>
                      </div>
                    )}
                    {(lead.locality || lead.city || lead.state || lead.country) && (
                      <div className="lead-view__field">
                        <span className="lead-view__field-label">Location</span>
                        <span className="lead-view__field-value">{[lead.locality, lead.city, lead.state, lead.country].filter(Boolean).join(', ')}</span>
                      </div>
                    )}
                    {lead.area && (
                      <div className="lead-view__field">
                        <span className="lead-view__field-label">Area</span>
                        <span className="lead-view__field-value">{lead.area}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Section: Assignment & Schedule */}
                <div className="lead-view__section">
                  <h4 className="lead-view__section-title">Assignment &amp; Schedule</h4>
                  <div className="lead-view__fields">
                    <div className="lead-view__field">
                      <span className="lead-view__field-label">Assigned To</span>
                      <span className="lead-view__field-value">{getAssignedNames(lead) || 'Unassigned'}</span>
                    </div>
                    <div className="lead-view__field">
                      <span className="lead-view__field-label">Source</span>
                      <span className="lead-view__field-value"><span className="lead-detail__source-chip">{lead.source_name || lead.source_type || '—'}</span></span>
                    </div>
                    {lead.next_followup_dt && (
                      <div className="lead-view__field">
                        <span className="lead-view__field-label"><Calendar size={11} /> Follow-up</span>
                        <span className="lead-view__field-value">{formatDate(lead.next_followup_dt)}</span>
                      </div>
                    )}
                    <div className="lead-view__field">
                      <span className="lead-view__field-label">Created</span>
                      <span className="lead-view__field-value">{formatDate(lead.create_dt)}</span>
                    </div>
                  </div>
                </div>

                {/* Other Details */}
                {lead.other_details && (
                  <div className="lead-view__section">
                    <h4 className="lead-view__section-title">Other Details</h4>
                    <p className="lead-view__notes-text lead-view__notes-text--card">{lead.other_details}</p>
                  </div>
                )}

                {/* Documents */}
                {(() => {
                  let docs = lead.documents;
                  if (typeof docs === 'string') {
                    try { docs = JSON.parse(docs); } catch { docs = []; }
                  }
                  if (!Array.isArray(docs) || docs.length === 0) return null;
                  return (
                    <div className="lead-view__section">
                      <h4 className="lead-view__section-title">Documents</h4>
                      <div className="lead-view__docs">
                        {docs.map((doc, idx) => {
                          const url = doc.path ? getFileUrl(doc.path) : null;
                          return (
                            <a
                              key={idx}
                              href={url || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="lead-view__doc-item"
                              onClick={(e) => { if (!url) e.preventDefault(); }}
                            >
                              <FileText size={14} />
                              <span className="lead-view__doc-name">{doc.name || `Document ${idx + 1}`}</span>
                              <ExternalLink size={12} className="lead-view__doc-ext" />
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Action row */}
                <div className="lead-view__actions">
                  <Button variant="outline" icon={lead.is_locked ? Unlock : Lock} size="sm" onClick={() => { handleLock(lead, { stopPropagation: () => { } }); }}>
                    {lead.is_locked ? 'Unlock' : 'Lock'}
                  </Button>
                  <Button variant="outline" icon={Zap} size="sm" onClick={() => { setShowViewModal(false); setTimeout(() => openQuickEdit(lead, { stopPropagation: () => { } }), 200); }}>Quick Edit</Button>
                  <Button variant="danger" icon={Trash2} size="sm" onClick={() => handleDelete(lead.l_id, lead.name)}>Delete</Button>
                </div>
              </div>

              {/* Right column — Activity Timeline */}
              <div className="lead-view__timeline">
                <h4 className="lead-view__timeline-title">Activity Timeline</h4>
                {viewLoading ? (
                  <div className="lead-view__tl-state"><span className="lead-view__tl-state-text">Loading activity...</span></div>
                ) : viewTimeline.length === 0 ? (
                  <div className="lead-view__tl-state"><span className="lead-view__tl-state-text">No activity yet</span></div>
                ) : (
                  <div className="lead-view__tl-list">
                    {viewTimeline.slice(0, 20).map((item, i) => {
                      const iconMap = { comment: MessageSquare, status_update: ArrowUpCircle, followup_set: Calendar, followup_done: Calendar, followup_missed: Clock, call: PhoneCall, system: Zap, email: Mail, whatsapp: Send };
                      const IconComp = iconMap[item.activity_type] || MessageSquare;
                      const colorMap = { comment: '#6366f1', status_update: '#10b981', followup_set: '#3b82f6', followup_done: '#22c55e', followup_missed: '#ef4444', call: '#f59e0b', system: '#8b5cf6', whatsapp: '#25d366' };
                      const iconColor = colorMap[item.activity_type] || '#6b7280';
                      const tAgo = (dt) => { const m = Math.floor((Date.now() - new Date(dt)) / 60000); if (m < 1) return 'Just now'; if (m < 60) return m + 'm ago'; const h = Math.floor(m / 60); if (h < 24) return h + 'h ago'; return Math.floor(h / 24) + 'd ago'; };
                      return (
                        <div key={item.lac_id || i} className="lead-view__tl-item">
                          <div className="lead-view__tl-connector" />
                          <div className="lead-view__tl-icon" style={{ background: iconColor + '18', color: iconColor }}>
                            <IconComp size={13} />
                          </div>
                          <div className="lead-view__tl-content">
                            <div className="lead-view__tl-text">{item.comment || item.activity_type?.replace(/_/g, ' ')}</div>
                            <div className="lead-view__tl-meta">
                              {item.user_name && <span className="lead-view__tl-user">{item.user_name}</span>}
                              <span className="lead-view__tl-time">{tAgo(item.create_dt)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Quick Edit Modal */}
      <Modal isOpen={showQuickEdit} onClose={() => { setShowQuickEdit(false); setQuickEditLead(null); }} title="Quick Edit" size="lg">
        {quickEditLead && (
          <div className="quick-edit__layout">
            <div className="quick-edit__form-side">
              <div className="quick-edit__lead-name">
                <div className="lead-table__avatar" style={{ borderColor: getNameColor(quickEditLead), color: getNameColor(quickEditLead), width: 36, height: 36, fontSize: 13 }}>
                  {getInitials(quickEditLead.name)}
                </div>
                <div>
                  <div className="quick-edit__name">{quickEditLead.name}</div>
                  <div className="quick-edit__phone">{quickEditLead.mobile}</div>
                </div>
              </div>
              <div className="quick-edit__grid">
                <div className="quick-edit__field">
                  <label>Lead Status</label>
                  <select name="ls_id" value={quickEditData.ls_id} onChange={handleQuickChange}>
                    <option value="">Select status...</option>
                    {statuses.map(s => <option key={s.ls_id} value={s.ls_id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="quick-edit__field">
                  <label>Priority</label>
                  <select name="lp_id" value={quickEditData.lp_id} onChange={handleQuickChange}>
                    <option value="">Select priority...</option>
                    {priorities.map(p => <option key={p.lp_id} value={p.lp_id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="quick-edit__field" style={{ marginTop: 14 }}>
                <label>Comment</label>
                <textarea
                  name="comment"
                  value={quickEditData.comment || ''}
                  onChange={handleQuickChange}
                  placeholder="Add a comment..."
                  rows={2}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13, resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>
              <div className="quick-edit__grid" style={{ marginTop: 14 }}>
                <div className="quick-edit__field">
                  <label>Set Follow-up</label>
                  <select name="setFollowup" value={quickEditData.setFollowup || 'no'} onChange={handleQuickChange}>
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </div>
                {quickEditData.setFollowup === 'yes' && (
                  <div className="quick-edit__field">
                    <label>Date & Time</label>
                    <input
                      type="datetime-local"
                      name="followup_dt"
                      value={quickEditData.followup_dt || ''}
                      onChange={handleQuickChange}
                      style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13 }}
                    />
                  </div>
                )}
              </div>
              <div className="modal__actions" style={{ marginTop: 20 }}>
                <Button variant="outline" onClick={() => { setShowQuickEdit(false); setQuickEditLead(null); }}>Cancel</Button>
                <Button variant="gold" onClick={handleQuickEditSave}>Save</Button>
              </div>
            </div>
            <div className="quick-edit__timeline-side">
              <h4 className="quick-edit__timeline-title">Timeline</h4>
              {timelineLoading ? (
                <div className="quick-edit__timeline-loading">Loading...</div>
              ) : quickEditTimeline.length === 0 ? (
                <div className="quick-edit__timeline-empty">No activity yet</div>
              ) : (
                <div className="quick-edit__timeline-list">
                  {(timelineExpanded ? quickEditTimeline : quickEditTimeline.slice(0, 10)).map((item, i) => {
                    const iconMap = {
                      comment: MessageSquare, status_update: ArrowUpCircle, followup_set: Calendar,
                      followup_done: Calendar, followup_missed: Clock, call: PhoneCall,
                      system: Zap, email: Mail, whatsapp: Send,
                    };
                    const IconComp = iconMap[item.activity_type] || MessageSquare;
                    const colorMap = {
                      comment: '#6366f1', status_update: '#10b981', followup_set: '#3b82f6',
                      followup_done: '#22c55e', followup_missed: '#ef4444', call: '#f59e0b',
                      system: '#8b5cf6', whatsapp: '#25d366',
                    };
                    const iconColor = colorMap[item.activity_type] || '#6b7280';
                    const timeAgo = (dt) => {
                      const diff = Date.now() - new Date(dt).getTime();
                      const mins = Math.floor(diff / 60000);
                      if (mins < 1) return 'Just now';
                      if (mins < 60) return `${mins}m ago`;
                      const hrs = Math.floor(mins / 60);
                      if (hrs < 24) return `${hrs}h ago`;
                      const days = Math.floor(hrs / 24);
                      return `${days}d ago`;
                    };
                    return (
                      <div key={item.lac_id || i} className="timeline-item">
                        <div className="timeline-item__icon" style={{ background: iconColor + '15', color: iconColor }}>
                          <IconComp size={14} />
                        </div>
                        <div className="timeline-item__content">
                          <div className="timeline-item__text">
                            {item.comment || item.description || item.activity_type?.replace(/_/g, ' ')}
                          </div>
                          <div className="timeline-item__meta">
                            {item.user_name && <span>{item.user_name}</span>}
                            <span>{timeAgo(item.create_dt)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {quickEditTimeline.length > 10 && (
                    <button
                      className="timeline-toggle-btn"
                      onClick={() => setTimelineExpanded(!timelineExpanded)}
                    >
                      {timelineExpanded ? 'View Less' : `View More (${quickEditTimeline.length - 10})`}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Bulk Assign Modal */}
      <Modal isOpen={showAssignModal} onClose={() => { setShowAssignModal(false); setBulkUserIds([]); setBulkStatusId(''); }} title="Assign User" size="sm">
        <div>
          <p className="bulk-assign__desc">Assign <strong>{selectedLeads.length} leads</strong> to users:</p>
          <div className="quick-edit__field" style={{ marginTop: 14 }}>
            <label>Select Users</label>
            <div className="bulk-assign__user-list">
              {assignUsers.map(u => {
                const selected = bulkUserIds.includes(u.u_id);
                return (
                  <div
                    key={u.u_id}
                    className={`bulk-assign__user-item${selected ? ' bulk-assign__user-item--selected' : ''}`}
                    onClick={() => toggleBulkUser(u.u_id)}
                  >
                    <div className="bulk-assign__user-check">
                      {selected && <CheckCircle size={16} />}
                    </div>
                    <div>
                      <div className="bulk-assign__user-name">{u.name || u.username}</div>
                      <div className="bulk-assign__user-role">{u.role_name}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            {bulkUserIds.length > 0 && (
              <div style={{ marginTop: 6, fontSize: 12, color: 'var(--gray-500)' }}>{bulkUserIds.length} user(s) selected</div>
            )}
          </div>
          <div className="quick-edit__field" style={{ marginTop: 14 }}>
            <label>Change Status (Optional)</label>
            <select value={bulkStatusId} onChange={e => setBulkStatusId(e.target.value)}>
              <option value="">Keep current status</option>
              {statuses.map(s => <option key={s.ls_id} value={s.ls_id}>{s.name}</option>)}
            </select>
          </div>
          <div className="modal__actions" style={{ marginTop: 20 }}>
            <Button variant="outline" onClick={() => { setShowAssignModal(false); setBulkUserIds([]); setBulkStatusId(''); }}>Cancel</Button>
            <Button variant="gold" onClick={handleBulkAssign} disabled={bulkUserIds.length === 0}>Assign</Button>
          </div>
        </div>
      </Modal>

      {/* Transfer Modal */}
      <Modal isOpen={showTransferModal} onClose={() => { setShowTransferModal(false); setTransferUserIds([]); setTransferStatusId(''); }} title="Transfer Leads" size="sm">
        <div>
          <p className="bulk-assign__desc">Transfer <strong>{selectedLeads.length} leads</strong> to:</p>
          <div className="quick-edit__field" style={{ marginTop: 14 }}>
            <label>Select Users</label>
            <div className="bulk-assign__user-list">
              {assignUsers.map(u => {
                const selected = transferUserIds.includes(u.u_id);
                return (
                  <div key={u.u_id}
                    className={`bulk-assign__user-item${selected ? ' bulk-assign__user-item--selected' : ''}`}
                    onClick={() => setTransferUserIds(prev => prev.includes(u.u_id) ? prev.filter(id => id !== u.u_id) : [...prev, u.u_id])}>
                    <div className="bulk-assign__user-check">{selected && <CheckCircle size={16} />}</div>
                    <div>
                      <div className="bulk-assign__user-name">{u.name || u.username}</div>
                      <div className="bulk-assign__user-role">{u.role_name}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="quick-edit__field" style={{ marginTop: 14 }}>
            <label>Change Status (Optional)</label>
            <select value={transferStatusId} onChange={e => setTransferStatusId(e.target.value)}>
              <option value="">Keep current status</option>
              {statuses.map(s => <option key={s.ls_id} value={s.ls_id}>{s.name}</option>)}
            </select>
          </div>
          <div className="modal__actions" style={{ marginTop: 20 }}>
            <Button variant="outline" onClick={() => { setShowTransferModal(false); setTransferUserIds([]); }}>Cancel</Button>
            <Button variant="gold" icon={Repeat} onClick={handleTransfer} disabled={transferUserIds.length === 0}>Transfer</Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      {deleteConfirm.show && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm({ show: false, id: null, name: '' })}>
          <div className="delete-confirm-modal animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="delete-confirm__icon">
              <Trash2 size={28} />
            </div>
            <h3 className="delete-confirm__title">Delete Lead</h3>
            <p className="delete-confirm__text">
              Are you sure you want to delete <strong>{deleteConfirm.name}</strong>? This action cannot be undone.
            </p>
            <div className="delete-confirm__actions">
              <Button variant="outline" onClick={() => setDeleteConfirm({ show: false, id: null, name: '' })}>Cancel</Button>
              <Button variant="danger" icon={Trash2} onClick={confirmDelete}>Delete</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default LeadTable;
