import React, { useState } from 'react';
import { Search, SlidersHorizontal, X, RotateCcw, ChevronDown } from 'lucide-react';
import { useCRM } from '../../context/CRMContext';
import './AdvancedSearch.css';

const AdvancedSearch = ({ filters, setFilters, showLeadType = false, onSearch }) => {
  const [expanded, setExpanded] = useState(false);
  const { masterData } = useCRM();

  const sources = masterData?.sources || [];
  const statuses = masterData?.statuses || [];
  const projects = masterData?.projects || [];
  const propertyTypes = masterData?.propertyTypes || [];

  const updateFilter = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    // Trigger search on filter change (debounced via parent)
    if (key !== 'search') onSearch?.(newFilters);
  };

  const resetFilters = () => {
    const empty = {
      search: '', status: '', priority: '', source: '',
      property_type: '', project: '', assigned: '',
      date_from: '', date_to: '', lead_type: '',
    };
    setFilters(empty);
    onSearch?.(empty);
  };

  const activeFilterCount = Object.entries(filters).filter(
    ([k, v]) => v && v !== '' && k !== 'search'
  ).length;

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') onSearch?.(filters);
  };

  // Resolve a filter value into a human-readable label (ID → name)
  const labelFor = (key, value) => {
    if (value === '' || value === null || value === undefined) return '';
    const str = String(value);
    switch (key) {
      case 'source': {
        const match = sources.find(s => String(s.src_id) === str);
        return match?.name || str;
      }
      case 'status': {
        const match = statuses.find(s => String(s.ls_id) === str);
        return match?.name || str;
      }
      case 'property_type': {
        const match = propertyTypes.find(t => String(t.pt_id) === str);
        return match?.name || str;
      }
      case 'project': {
        const match = projects.find(p => String(p.project_id) === str);
        return match?.name || str;
      }
      case 'assigned':
        return str === 'assigned' ? 'Assigned' : str === 'non_assigned' ? 'Unassigned' : str;
      case 'lead_type':
        return str.charAt(0).toUpperCase() + str.slice(1);
      default:
        return str;
    }
  };

  const prettyKey = (k) => {
    const map = {
      source: 'Source', status: 'Status', property_type: 'Property Type',
      project: 'Project', assigned: 'Assignment', lead_type: 'Lead Type',
      date_from: 'From', date_to: 'To',
    };
    return map[k] || k.replace(/_/g, ' ');
  };

  return (
    <div className="adv-search">
      {/* Primary Search Bar */}
      <div className="adv-search__bar">
        <div className="adv-search__input-wrap">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search by name, phone, email..."
            value={filters.search || ''}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            onKeyDown={handleSearchKeyDown}
            className="adv-search__input"
          />
          {filters.search && (
            <button className="adv-search__clear-input" onClick={() => { updateFilter('search', ''); onSearch?.({ ...filters, search: '' }); }}>
              <X size={14} />
            </button>
          )}
        </div>
        <button
          className={`adv-search__toggle ${expanded ? 'adv-search__toggle--active' : ''}`}
          onClick={() => setExpanded(!expanded)}
        >
          <SlidersHorizontal size={16} />
          Filters
          {activeFilterCount > 0 && <span className="adv-search__count">{activeFilterCount}</span>}
          <ChevronDown size={14} className={expanded ? 'adv-search__chevron--open' : ''} />
        </button>
        {activeFilterCount > 0 && (
          <button className="adv-search__reset" onClick={resetFilters}>
            <RotateCcw size={14} /> Reset
          </button>
        )}
      </div>

      {/* Expanded Advanced Filters */}
      {expanded && (
        <div className="adv-search__panel animate-fade-in">
          <h4 className="adv-search__panel-title">Advanced Filters</h4>
          <div className="adv-search__grid">
            <div className="adv-search__field">
              <label>Source</label>
              <select value={filters.source || ''} onChange={(e) => updateFilter('source', e.target.value)}>
                <option value="">All Sources</option>
                {sources.map(s => <option key={s.src_id} value={s.src_id}>{s.name}</option>)}
              </select>
            </div>
            <div className="adv-search__field">
              <label>Status</label>
              <select value={filters.status || ''} onChange={(e) => updateFilter('status', e.target.value)}>
                <option value="">All Statuses</option>
                {statuses.map(s => <option key={s.ls_id} value={s.ls_id}>{s.name}</option>)}
              </select>
            </div>
            <div className="adv-search__field">
              <label>Property Type</label>
              <select value={filters.property_type || ''} onChange={(e) => updateFilter('property_type', e.target.value)}>
                <option value="">All Types</option>
                {propertyTypes.map(t => <option key={t.pt_id} value={t.pt_id}>{t.name}</option>)}
              </select>
            </div>
            <div className="adv-search__field">
              <label>Project</label>
              <select value={filters.project || ''} onChange={(e) => updateFilter('project', e.target.value)}>
                <option value="">All Projects</option>
                {projects.map(p => <option key={p.project_id} value={p.project_id}>{p.name}</option>)}
              </select>
            </div>
            <div className="adv-search__field">
              <label>Assignment</label>
              <select value={filters.assigned || ''} onChange={(e) => updateFilter('assigned', e.target.value)}>
                <option value="">All</option>
                <option value="assigned">Assigned</option>
                <option value="non_assigned">Unassigned</option>
              </select>
            </div>
            {showLeadType && (
              <div className="adv-search__field">
                <label>Lead Type</label>
                <select value={filters.lead_type || ''} onChange={(e) => updateFilter('lead_type', e.target.value)}>
                  <option value="">All Types</option>
                  <option value="fresh">Fresh</option>
                  <option value="imported">Imported</option>
                </select>
              </div>
            )}
            <div className="adv-search__field">
              <label>Date From</label>
              <input type="date" value={filters.date_from || ''} onChange={(e) => updateFilter('date_from', e.target.value)} />
            </div>
            <div className="adv-search__field">
              <label>Date To</label>
              <input type="date" value={filters.date_to || ''} onChange={(e) => updateFilter('date_to', e.target.value)} />
            </div>
          </div>

          {activeFilterCount > 0 && (
            <div className="adv-search__active-filters">
              <span className="adv-search__active-label">Active filters:</span>
              {Object.entries(filters)
                .filter(([k, v]) => v && v !== '' && k !== 'search')
                .map(([k, v]) => (
                  <span key={k} className="adv-search__active-chip">
                    {prettyKey(k)}: <strong>{labelFor(k, v)}</strong>
                    <button onClick={() => updateFilter(k, '')}>
                      <X size={10} />
                    </button>
                  </span>
                ))
              }
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdvancedSearch;
