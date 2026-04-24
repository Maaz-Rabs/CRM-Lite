import React, { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Header from '../../components/layout/Header';
import LeadTable from '../../components/leads/LeadTable';
import AdvancedSearch from '../../components/leads/AdvancedSearch';
import useLeads from '../../hooks/useLeads';
import { Calendar, AlertTriangle, Clock } from 'lucide-react';
import './Followup.css';

const TABS = [
  { key: 'today', label: 'Today', path: '/followup/today', color: '#3b82f6', icon: Calendar },
  { key: 'missed', label: 'Missed', path: '/followup/missed', color: '#ef4444', icon: AlertTriangle },
  { key: 'upcoming', label: 'Upcoming', path: '/followup/upcoming', color: '#22c55e', icon: Clock },
];

const FollowupPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const pathTab = location.pathname.split('/').pop();
  const activeTab = TABS.find(t => t.key === pathTab)?.key || 'today';

  const baseFilters = useMemo(() => ({ followup_filter: activeTab }), [activeTab]);
  const { leads, loading, pagination, filters, setFilters, onSearch, onPageChange, refresh } = useLeads(baseFilters);

  const tabColor = TABS.find(t => t.key === activeTab)?.color || '#3b82f6';

  return (
    <div>
      <Header title="Follow-ups" subtitle="Manage your follow-up schedule" />
      <div className="page">
        {/* Tab Cards */}
        <div className="fu-tabs">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                className={`fu-tab ${isActive ? 'fu-tab--active' : ''}`}
                style={{ '--fu-color': tab.color }}
                onClick={() => navigate(tab.path)}
              >
                <Icon size={18} />
                <span className="fu-tab__label">{tab.label}</span>
              </button>
            );
          })}
        </div>

        <AdvancedSearch filters={filters} setFilters={setFilters} onSearch={onSearch} />

        <LeadTable
          leads={leads}
          loading={loading}
          pagination={pagination}
          onPageChange={onPageChange}
          onRefresh={refresh}
          showLeadType={false}
          pageAccentColor={tabColor}
          emptyMessage={`No ${activeTab} follow-ups found`}
        />
      </div>
    </div>
  );
};

export default FollowupPage;
