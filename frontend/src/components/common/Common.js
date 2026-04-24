import React from 'react';
import { X } from 'lucide-react';
import './Common.css';

// Button Component
export const Button = ({ children, variant = 'primary', size = 'md', icon: Icon, onClick, className = '', ...props }) => (
  <button
    className={`btn btn--${variant} btn--${size} ${className}`}
    onClick={onClick}
    {...props}
  >
    {Icon && <Icon size={size === 'sm' ? 14 : 16} />}
    {children}
  </button>
);

// Badge Component
export const Badge = ({ children, variant = 'default', dot = false, className = '' }) => (
  <span className={`badge badge--${variant} ${className}`}>
    {dot && <span className="badge__dot" />}
    {children}
  </span>
);

// Stat Card
export const StatCard = ({ icon: Icon, label, value, change, changeType = 'positive', accent = false }) => (
  <div className={`stat-card ${accent ? 'stat-card--accent' : ''} animate-fade-in`}>
    <div className="stat-card__header">
      <div className={`stat-card__icon ${accent ? 'stat-card__icon--accent' : ''}`}>
        <Icon size={20} />
      </div>
      {change && (
        <span className={`stat-card__change stat-card__change--${changeType}`}>
          {changeType === 'positive' ? '+' : ''}{change}
        </span>
      )}
    </div>
    <p className="stat-card__value">{value}</p>
    <p className="stat-card__label">{label}</p>
  </div>
);

// Modal Component
export const Modal = ({ isOpen, onClose, title, children, size = 'md' }) => {
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal modal--${size} animate-scale-in`} onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title">{title}</h2>
          <button className="modal__close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="modal__body">
          {children}
        </div>
      </div>
    </div>
  );
};

// Table Component
export const Table = ({ columns, data, onRowClick, emptyMessage = 'No data found' }) => (
  <div className="table-wrapper">
    <table className="table">
      <thead>
        <tr>
          {columns.map((col, i) => (
            <th key={i} style={col.width ? { width: col.width } : {}}>{col.header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.length === 0 ? (
          <tr>
            <td colSpan={columns.length} className="table__empty">{emptyMessage}</td>
          </tr>
        ) : (
          data.map((row, i) => (
            <tr key={row.id || i} onClick={() => onRowClick?.(row)} className={onRowClick ? 'table__row--clickable' : ''}>
              {columns.map((col, j) => (
                <td key={j}>{col.render ? col.render(row) : row[col.key]}</td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
);

// Form Input
export const FormInput = ({ label, error, ...props }) => (
  <div className="form-group">
    {label && <label className="form-label">{label}</label>}
    <input className={`form-input ${error ? 'form-input--error' : ''}`} {...props} />
    {error && <span className="form-error">{error}</span>}
  </div>
);

// Form Select
export const FormSelect = ({ label, options, error, placeholder = 'Select...', ...props }) => (
  <div className="form-group">
    {label && <label className="form-label">{label}</label>}
    <select className={`form-select ${error ? 'form-select--error' : ''}`} {...props}>
      <option value="">{placeholder}</option>
      {options.map((opt, i) => (
        <option key={i} value={typeof opt === 'string' ? opt : opt.value}>
          {typeof opt === 'string' ? opt : opt.label}
        </option>
      ))}
    </select>
    {error && <span className="form-error">{error}</span>}
  </div>
);

// Empty State
export const EmptyState = ({ icon: Icon, title, description, action }) => (
  <div className="empty-state">
    {Icon && <div className="empty-state__icon"><Icon size={48} /></div>}
    <h3 className="empty-state__title">{title}</h3>
    {description && <p className="empty-state__description">{description}</p>}
    {action}
  </div>
);

// Priority Badge
export const PriorityBadge = ({ priority }) => {
  const variants = { Hot: 'danger', Warm: 'warning', Cold: 'info' };
  return <Badge variant={variants[priority] || 'default'} dot>{priority}</Badge>;
};

// Status Badge
export const StatusBadge = ({ status }) => {
  const variants = {
    New: 'info', Contacted: 'warning', 'Follow Up': 'warning',
    'Site Visit': 'primary', Negotiation: 'accent', Won: 'success', Lost: 'danger',
    Active: 'success', Inactive: 'default', 'On Leave': 'warning',
    Present: 'success', Late: 'warning', Absent: 'danger'
  };
  return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
};
