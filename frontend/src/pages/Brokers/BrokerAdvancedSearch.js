import React, { useState } from 'react';
import { Search, SlidersHorizontal, X, RotateCcw, ChevronDown } from 'lucide-react';
import '../../components/leads/AdvancedSearch.css';

const EMPTY_FILTERS = {
  search: '',
  status: '',
  specialization: '',
  location: '',
  date_from: '',
  date_to: '',
};

const BrokerAdvancedSearch = ({ filters, setFilters, onSearch }) => {
  const [expanded, setExpanded] = useState(false);

  const updateFilter = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    if (key !== 'search') onSearch?.(newFilters);
  };

  const resetFilters = () => {
    setFilters(EMPTY_FILTERS);
    onSearch?.(EMPTY_FILTERS);
  };

  const activeFilterCount = Object.entries(filters).filter(
    ([k, v]) => v && v !== '' && k !== 'search'
  ).length;

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') onSearch?.(filters);
  };

  return (
    <div className="adv-search">
      <div className="adv-search__bar">
        <div className="adv-search__input-wrap">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search by name, mobile, RERA, company, email..."
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

      {expanded && (
        <div className="adv-search__panel animate-fade-in">
          <h4 className="adv-search__panel-title">Advanced Filters</h4>
          <div className="adv-search__grid">
            <div className="adv-search__field">
              <label>Status</label>
              <select value={filters.status || ''} onChange={(e) => updateFilter('status', e.target.value)}>
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
            <div className="adv-search__field">
              <label>Specialization</label>
              <select value={filters.specialization || ''} onChange={(e) => updateFilter('specialization', e.target.value)}>
                <option value="">All Specializations</option>
                <option value="residential">Residential</option>
                <option value="commercial">Commercial</option>
                <option value="both">Both</option>
              </select>
            </div>
            <div className="adv-search__field">
              <label>Location</label>
              <input
                type="text"
                placeholder="City or address..."
                value={filters.location || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, location: e.target.value }))}
                onBlur={() => onSearch?.(filters)}
                onKeyDown={(e) => { if (e.key === 'Enter') onSearch?.(filters); }}
              />
            </div>
            <div className="adv-search__field">
              <label>Joined From</label>
              <input type="date" value={filters.date_from || ''} onChange={(e) => updateFilter('date_from', e.target.value)} />
            </div>
            <div className="adv-search__field">
              <label>Joined To</label>
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
                    {k.replace(/_/g, ' ')}: <strong>{v}</strong>
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

export default BrokerAdvancedSearch;
