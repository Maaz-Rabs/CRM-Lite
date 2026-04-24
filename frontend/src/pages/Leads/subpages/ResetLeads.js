import React from 'react';
import Header from '../../../components/layout/Header';
import AdvancedSearch from '../../../components/leads/AdvancedSearch';
import LeadTable from '../../../components/leads/LeadTable';
import useLeads from '../../../hooks/useLeads';

const ResetLeads = () => {
  // Reset leads = leads without status (no_status)
  const { leads, loading, pagination, filters, setFilters, onSearch, onPageChange, refresh } = useLeads({ no_status: true });

  return (
    <div>
      <Header title="Reset Leads" subtitle={`${pagination.total || 0} reset leads`} />
      <div className="page">
        <AdvancedSearch filters={filters} setFilters={setFilters} onSearch={onSearch} />
        <LeadTable
          leads={leads}
          loading={loading}
          pagination={pagination}
          onPageChange={onPageChange}
          onRefresh={refresh}
          showLeadType={false}
          pageAccentColor="#6b7280"
          emptyMessage="No reset leads found"
        />
      </div>
    </div>
  );
};
export default ResetLeads;
