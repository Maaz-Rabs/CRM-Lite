import React, { useState } from 'react';
import { useCRM } from '../../../context/CRMContext';
import Header from '../../../components/layout/Header';
import AdvancedSearch from '../../../components/leads/AdvancedSearch';
import LeadTable from '../../../components/leads/LeadTable';
import useLeads from '../../../hooks/useLeads';
import './StatusWiseLeads.css';

const StatusWiseLeads = () => {
  const { masterData, categoryCounts } = useCRM();
  const [selectedStatus, setSelectedStatus] = useState(null);

  const baseFilters = selectedStatus ? { status: selectedStatus } : {};
  const { leads, loading, pagination, filters, setFilters, onSearch, onPageChange, refresh } = useLeads(baseFilters);

  // Use statusCounts from categoryCounts if available, fallback to masterData.statuses
  const statuses = categoryCounts?.statusCounts?.length
    ? categoryCounts.statusCounts
    : (masterData?.statuses || []).map(s => ({ ...s, team_count: 0, self_count: 0 }));

  const handleStatusClick = (statusId) => {
    if (selectedStatus === statusId) {
      setSelectedStatus(null);
    } else {
      setSelectedStatus(statusId);
    }
  };

  // When selectedStatus changes, trigger refresh
  React.useEffect(() => {
    refresh();
  }, [selectedStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <Header title="Status Wise" subtitle="View leads grouped by status" />
      <div className="page">
        <div className="status-grid" style={{ marginTop: 28 }}>
          {statuses.map(status => (
            <div key={status.ls_id}
              className={`status-card ${selectedStatus === status.ls_id ? 'status-card--selected' : ''}`}
              onClick={() => handleStatusClick(status.ls_id)}
              style={{ '--status-color': status.color || '#6b7280' }}>
              <div className="status-card__top">
                <span className="status-card__dot" style={{ background: status.color || '#6b7280' }} />
                <div className="status-card__counts">
                  <span className="status-card__count">{status.team_count}</span>
                  <span className="status-card__self">Self: {status.self_count}</span>
                </div>
              </div>
              <span className="status-card__label">{status.name}</span>
            </div>
          ))}
        </div>

        {selectedStatus && (
          <div className="status-selected-header animate-fade-in">
            <h3>Showing <strong>{statuses.find(s => s.ls_id === selectedStatus)?.name}</strong> leads</h3>
            <button className="btn btn--ghost btn--sm" onClick={() => setSelectedStatus(null)}>Show All</button>
          </div>
        )}

        <AdvancedSearch filters={filters} setFilters={setFilters} onSearch={onSearch} />
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
export default StatusWiseLeads;
