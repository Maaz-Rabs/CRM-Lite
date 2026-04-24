import { useState, useEffect, useCallback, useRef } from 'react';
import { useCRM } from '../context/CRMContext';

/**
 * Hook to fetch leads from API with filters and pagination.
 * @param {Object} baseFilters - Default filters to always apply (e.g., { is_fresh: true })
 */
const useLeads = (baseFilters = {}) => {
  const { fetchLeads } = useCRM();
  const [leads, setLeads] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: '', status: '', priority: '', source: '',
    property_type: '', project: '', assigned: '',
    date_from: '', date_to: '',
  });

  const currentPage = useRef(1);
  const currentLimit = useRef(25);

  const loadLeads = useCallback(async (overrideFilters, page, limit) => {
    setLoading(true);
    try {
      const f = overrideFilters || filters;
      const params = { ...baseFilters };

      params.page = page || currentPage.current;
      params.limit = limit || currentLimit.current;

      if (f.search) params.search = f.search;
      if (f.status) params.status = f.status;
      if (f.priority) params.priority = f.priority;
      if (f.source) params.source = f.source;
      if (f.property_type) params.property_types = f.property_type;
      if (f.project) params.projects = f.project;
      if (f.assigned) params.assign_status = f.assigned;
      if (f.date_from) params.created_from = f.date_from;
      if (f.date_to) params.created_to = f.date_to;
      if (f.followup_from) params.followup_from = f.followup_from;
      if (f.followup_to) params.followup_to = f.followup_to;
      if (f.followup_filter) params.followup_filter = f.followup_filter;
      if (f.lead_type === 'fresh') params.is_fresh = true;
      else if (f.lead_type === 'imported') params.is_imported = true;

      const res = await fetchLeads(params);
      if (res.success) {
        setLeads(res.data?.leads || []);
        setPagination(res.data?.pagination || {});
      }
    } catch (err) {
      console.error('useLeads error:', err);
    } finally {
      setLoading(false);
    }
  }, [fetchLeads, filters, baseFilters]);

  // Load on mount and when baseFilters change
  const baseKey = JSON.stringify(baseFilters);
  useEffect(() => {
    currentPage.current = 1;
    loadLeads(undefined, 1);
  }, [baseKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSearch = useCallback((newFilters) => {
    currentPage.current = 1;
    loadLeads(newFilters, 1);
  }, [loadLeads]);

  const onPageChange = useCallback((page, limit) => {
    currentPage.current = page;
    if (limit) currentLimit.current = limit;
    loadLeads(filters, page, limit);
  }, [loadLeads, filters]);

  const refresh = useCallback(() => {
    loadLeads();
  }, [loadLeads]);

  return {
    leads,
    loading,
    pagination,
    filters,
    setFilters,
    onSearch,
    onPageChange,
    refresh,
  };
};

export default useLeads;
