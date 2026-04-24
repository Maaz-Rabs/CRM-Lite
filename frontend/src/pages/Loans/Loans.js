import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCRM } from '../../context/CRMContext';
import Header from '../../components/layout/Header';
import { Button, Badge, Table, Modal, StatCard } from '../../components/common/Common';
import { Plus, Search, DollarSign, TrendingUp, CheckCircle, Clock, Edit2, Trash2 } from 'lucide-react';
import './Loans.css';

const Loans = () => {
  const { fetchLoans, fetchLoanStats, deleteLoanRecord } = useCRM();
  const navigate = useNavigate();
  const [loans, setLoans] = useState([]);
  const [stats, setStats] = useState({});
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    loadLoans();
    loadStats();
  }, []);

  const loadLoans = async () => {
    setLoading(true);
    const res = await fetchLoans({ search, status: statusFilter !== 'All' ? statusFilter : null, loan_type: typeFilter !== 'All' ? typeFilter : null });
    if (res.success) setLoans(res.data);
    setLoading(false);
  };

  const loadStats = async () => {
    const res = await fetchLoanStats();
    if (res.success) setStats(res.data);
  };

  const filteredLoans = useMemo(() => {
    return loans.filter(l => {
      const q = search.toLowerCase();
      const matchSearch = !q || l.applicant_name.toLowerCase().includes(q) || l.applicant_phone.includes(q) || (l.loan_reference || '').includes(q);
      const matchStatus = statusFilter === 'All' || l.status === statusFilter;
      const matchType = typeFilter === 'All' || l.loan_type === typeFilter;
      return matchSearch && matchStatus && matchType;
    });
  }, [loans, search, statusFilter, typeFilter]);

  const showNotification = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleDeleteLoan = async (id) => {
    if (!window.confirm('Are you sure you want to delete this loan record?')) return;
    const res = await deleteLoanRecord(id);
    if (res.success) {
      showNotification('Loan deleted successfully', 'success');
      loadLoans();
      loadStats();
    } else {
      showNotification(res.message || 'Failed to delete loan', 'error');
    }
  };

  const openViewModal = (loan) => {
    setSelectedLoan(loan);
    setShowViewModal(true);
  };

  const getStatusColor = (status) => {
    const colors = {
      'Pending': 'primary',
      'Approved': 'success',
      'Rejected': 'danger',
      'Active': 'success',
      'Closed': 'gray',
    };
    return colors[status] || 'primary';
  };

  const columns = [
    {
      header: 'Applicant', render: (row) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <p style={{ fontWeight: 600, color: 'var(--navy-800)', fontSize: '13px' }}>{row.applicant_name}</p>
          <p style={{ fontSize: '11px', color: 'var(--gray-500)', marginTop: '2px' }}>{row.applicant_phone}</p>
        </div>
      )
    },
    { header: 'Type', render: (row) => <Badge variant="primary">{row.loan_type}</Badge> },
    { header: 'Amount', render: (row) => <span style={{ fontWeight: 600, color: 'var(--gold-700)', fontSize: '13px' }}>₹ {Number(row.loan_amount).toLocaleString('en-IN')}</span> },
    { header: 'Lender', render: (row) => <span style={{ fontSize: '13px', color: 'var(--gray-700)' }}>{row.lender_name || '—'}</span> },
    { header: 'EMI', render: (row) => <span style={{ fontSize: '13px', color: 'var(--gray-700)' }}>₹ {row.emi_amount ? Number(row.emi_amount).toLocaleString('en-IN') : '—'}</span> },
    { header: 'Status', render: (row) => <Badge variant={getStatusColor(row.status)}>{row.status}</Badge> },
    {
      header: 'Actions', width: '100px', render: (row) => (
        <div style={{ display: 'flex', gap: '6px' }}>
          <button className="btn btn--ghost btn--sm" title="Edit" onClick={(e) => { e.stopPropagation(); navigate(`/loans/edit/${row.loan_id}`); }}><Edit2 size={14} /></button>
          <button className="btn btn--ghost btn--sm" title="Delete" onClick={(e) => { e.stopPropagation(); handleDeleteLoan(row.loan_id); }} style={{ color: 'var(--danger)' }}><Trash2 size={14} /></button>
        </div>
      )
    }
  ];

  return (
    <div>
      <Header
        title="Loan Management"
        subtitle={`${loans.length} loans`}
        actions={<Button variant="gold" icon={Plus} onClick={() => navigate('/loans/add')}>Add Loan</Button>}
      />
      <div className="page">
        <div className="page__grid page__grid--stats">
          <StatCard icon={DollarSign} label="Total Loans" value={stats.total || 0} />
          <StatCard icon={TrendingUp} label="Total Amount" value={`₹ ${stats.total_amount ? (stats.total_amount / 10000000).toFixed(1) : 0} Cr`} accent />
          <StatCard icon={CheckCircle} label="Approved" value={stats.by_status?.find(s => s.status === 'Approved')?.count || 0} />
          <StatCard icon={Clock} label="Pending" value={stats.by_status?.find(s => s.status === 'Pending')?.count || 0} />
        </div>

        <div className="filter-bar">
          <div className="filter-bar__search">
            <Search size={16} />
            <input placeholder="Search by name, phone, or ref..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {['All', 'Pending', 'Approved', 'Rejected', 'Active', 'Closed'].map(s => (
            <button key={s} className={`filter-chip ${statusFilter === s ? 'filter-chip--active' : ''}`} onClick={() => setStatusFilter(s)}>{s}</button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--gray-500)' }}>Loading...</div>
        ) : filteredLoans.length > 0 ? (
          <Table columns={columns} data={filteredLoans} onRowClick={openViewModal} />
        ) : (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--gray-500)' }}>No loans found</div>
        )}
      </div>

      <Modal isOpen={showViewModal} onClose={() => setShowViewModal(false)} title="Loan Details" size="md">
        {selectedLoan && (
          <div>
            <div className="lead-detail__header">
              <div style={{ flex: 1 }}>
                <h3 className="lead-detail__name">{selectedLoan.applicant_name}</h3>
                <p className="lead-detail__sub">{selectedLoan.loan_type}{selectedLoan.loan_reference ? ` · ${selectedLoan.loan_reference}` : ''}</p>
              </div>
              <div>
                <Button variant="primary" icon={Edit2} size="sm" onClick={() => navigate(`/loans/edit/${selectedLoan.loan_id}`)}>Edit</Button>
              </div>
            </div>
            <div className="lead-detail__grid">
              <div className="lead-detail__item"><span className="lead-detail__label">Phone</span><span className="lead-detail__value">{selectedLoan.applicant_phone}</span></div>
              <div className="lead-detail__item"><span className="lead-detail__label">Email</span><span className="lead-detail__value">{selectedLoan.applicant_email || '—'}</span></div>
              <div className="lead-detail__item"><span className="lead-detail__label">Loan Amount</span><span className="lead-detail__value">₹ {Number(selectedLoan.loan_amount).toLocaleString('en-IN')}</span></div>
              <div className="lead-detail__item"><span className="lead-detail__label">EMI</span><span className="lead-detail__value">₹ {selectedLoan.emi_amount ? Number(selectedLoan.emi_amount).toLocaleString('en-IN') : '—'}</span></div>
              <div className="lead-detail__item"><span className="lead-detail__label">Interest Rate</span><span className="lead-detail__value">{selectedLoan.interest_rate ? `${selectedLoan.interest_rate}%` : '—'}</span></div>
              <div className="lead-detail__item"><span className="lead-detail__label">Tenure</span><span className="lead-detail__value">{selectedLoan.tenure_months ? `${selectedLoan.tenure_months} months` : '—'}</span></div>
              <div className="lead-detail__item"><span className="lead-detail__label">Lender</span><span className="lead-detail__value">{selectedLoan.lender_name || '—'}</span></div>
              <div className="lead-detail__item"><span className="lead-detail__label">Status</span><Badge variant={getStatusColor(selectedLoan.status)}>{selectedLoan.status}</Badge></div>
              <div className="lead-detail__item"><span className="lead-detail__label">Approval Date</span><span className="lead-detail__value">{selectedLoan.approval_date ? String(selectedLoan.approval_date).slice(0, 10) : '—'}</span></div>
              <div className="lead-detail__item"><span className="lead-detail__label">Start Date</span><span className="lead-detail__value">{selectedLoan.start_date ? String(selectedLoan.start_date).slice(0, 10) : '—'}</span></div>
            </div>
            {selectedLoan.notes && (
              <div style={{ marginTop: '20px', padding: '12px', background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 8 }}>
                <p style={{ fontSize: '12px', color: 'var(--gray-700)', whiteSpace: 'pre-wrap' }}>{selectedLoan.notes}</p>
              </div>
            )}
          </div>
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

export default Loans;
