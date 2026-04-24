import { useState, useMemo } from 'react';

const defaultFilters = {
  search: '', status: 'All', priority: 'All', source: 'All',
  property_type: 'All', location: 'All', project: 'All',
  assigned: 'All', assigned_to: 'All', date_from: '', date_to: '',
  budget_min: '', budget_max: '', lead_type: 'All',
};

const useLeadFilters = (leads, extraFilter = null) => {
  const [filters, setFilters] = useState({ ...defaultFilters });

  const filteredLeads = useMemo(() => {
    let result = leads;

    if (extraFilter) {
      result = result.filter(extraFilter);
    }

    return result.filter(l => {
      const q = (filters.search || '').toLowerCase();
      const matchSearch = !q ||
        l.name.toLowerCase().includes(q) ||
        l.phone.includes(q) ||
        (l.email || '').toLowerCase().includes(q) ||
        (l.location || '').toLowerCase().includes(q) ||
        (l.project || '').toLowerCase().includes(q) ||
        (l.notes || '').toLowerCase().includes(q) ||
        (l.assigned_to || '').toLowerCase().includes(q) ||
        (l.source || '').toLowerCase().includes(q) ||
        (l.property_type || '').toLowerCase().includes(q) ||
        (l.budget || '').toLowerCase().includes(q);

      const matchStatus = filters.status === 'All' || l.status === filters.status;
      const matchPriority = filters.priority === 'All' || l.priority === filters.priority;
      const matchSource = filters.source === 'All' || l.source === filters.source;
      const matchPropertyType = filters.property_type === 'All' || l.property_type === filters.property_type;
      const matchLocation = filters.location === 'All' || l.location === filters.location;
      const matchProject = filters.project === 'All' || l.project === filters.project;
      const matchLeadType = filters.lead_type === 'All' || l.lead_type === filters.lead_type;

      let matchAssigned = true;
      if (filters.assigned === 'assigned') matchAssigned = !!l.assigned_to;
      else if (filters.assigned === 'unassigned') matchAssigned = !l.assigned_to;

      let matchAssignedTo = true;
      if (filters.assigned_to && filters.assigned_to !== 'All') {
        matchAssignedTo = l.assigned_to === filters.assigned_to;
      }

      let matchDateFrom = true;
      if (filters.date_from) matchDateFrom = l.created_at >= filters.date_from;

      let matchDateTo = true;
      if (filters.date_to) matchDateTo = l.created_at <= filters.date_to;

      return matchSearch && matchStatus && matchPriority && matchSource &&
        matchPropertyType && matchLocation && matchProject && matchLeadType &&
        matchAssigned && matchAssignedTo && matchDateFrom && matchDateTo;
    });
  }, [leads, filters, extraFilter]);

  return { filters, setFilters, filteredLeads };
};

export default useLeadFilters;
