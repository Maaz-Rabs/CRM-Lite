import React from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../../components/layout/Header';
import AdvancedSearch from '../../../components/leads/AdvancedSearch';
import LeadTable from '../../../components/leads/LeadTable';
import { Button } from '../../../components/common/Common';
import useLeads from '../../../hooks/useLeads';
import { PlusCircle } from 'lucide-react';

const TotalLeads = () => {
  const navigate = useNavigate();
  const { leads, loading, pagination, filters, setFilters, onSearch, onPageChange, refresh } = useLeads({ exclude_imported: true });

  return (
    <div>
      <Header
        title="Total Leads"
        subtitle={`Manage all ${pagination.total || 0} leads`}
        actions={<Button variant="gold" icon={PlusCircle} onClick={() => navigate('/leads/add')}>Add Lead</Button>}
      />
      <div className="page">
        <div>
          <AdvancedSearch filters={filters} setFilters={setFilters} onSearch={onSearch} showLeadType />
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
    </div>
  );
};
export default TotalLeads;