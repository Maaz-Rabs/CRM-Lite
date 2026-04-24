import React from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../../components/layout/Header';
import AdvancedSearch from '../../../components/leads/AdvancedSearch';
import LeadTable from '../../../components/leads/LeadTable';
import useLeads from '../../../hooks/useLeads';
import { Plus } from 'lucide-react';
import { Button } from '../../../components/common/Common';

const FreshLeads = () => {
  const navigate = useNavigate();
  const { leads, loading, pagination, filters, setFilters, onSearch, onPageChange, refresh } = useLeads({ is_fresh: true, is_imported: false });

  return (
    <div>
      <Header title="Fresh Leads" subtitle={`${pagination.total || 0} fresh leads`} actions={<Button variant="gold" icon={Plus} onClick={() => navigate('/leads/add')}>Add Lead</Button>} />
      <div className="page">
        <AdvancedSearch filters={filters} setFilters={setFilters} onSearch={onSearch} />
        <LeadTable
          leads={leads}
          loading={loading}
          pagination={pagination}
          onPageChange={onPageChange}
          onRefresh={refresh}
          showLeadType={false}
          pageAccentColor="#e6197a"
          emptyMessage="No fresh leads found"
        />
      </div>
    </div>
  );
};
export default FreshLeads;
