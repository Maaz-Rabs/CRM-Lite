import React from 'react';
import Header from '../../../components/layout/Header';
import AdvancedSearch from '../../../components/leads/AdvancedSearch';
import LeadTable from '../../../components/leads/LeadTable';
import useLeads from '../../../hooks/useLeads';

const NonAssignLeads = () => {
  const { leads, loading, pagination, filters, setFilters, onSearch, onPageChange, refresh } = useLeads({ assign_status: 'non_assigned', is_imported: false });

  return (
    <div>
      <Header title="Unassigned Leads" subtitle={`${pagination.total || 0} leads need assignment`} />
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
export default NonAssignLeads;
