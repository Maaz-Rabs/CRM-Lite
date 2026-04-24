import React from 'react';
import Header from '../../../components/layout/Header';
import AdvancedSearch from '../../../components/leads/AdvancedSearch';
import LeadTable from '../../../components/leads/LeadTable';
import useLeads from '../../../hooks/useLeads';

const AssignLeads = () => {
  const { leads, loading, pagination, filters, setFilters, onSearch, onPageChange, refresh } = useLeads({ assign_status: 'assigned' });

  return (
    <div>
      <Header title="Assigned Leads" subtitle={`${pagination.total || 0} assigned leads`} />
      <div className="page">
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
export default AssignLeads;
