import React, { useState, useCallback, useEffect } from 'react';
import {
  Link2, Building2, Globe,
  Plus, RefreshCw, Zap, CheckCircle, Clock, Trash2, Eye, EyeOff,
  AlertCircle, Search, X, Loader
} from 'lucide-react';
import Header from '../../components/layout/Header';
import { Modal, Button } from '../../components/common/Common';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import './Integration.css';

const PROXY_BASE = 'http://localhost:5000/api/lead-integration';

const ALL_SOURCES = [
  { id: '99acres', source_name: '99acres', name: '99acres', description: 'Import property inquiries from 99acres', icon: Building2, color: '#FF6B35', category: 'portal', available: true,
    fields: [
      { key: 'branch', label: 'Branch', placeholder: 'e.g., Mumbai', required: true, group: 'meta' },
      { key: 'acres_username', label: 'Username / Email', placeholder: 'Your 99acres username', required: true, group: 'credentials' },
      { key: 'acres_password', label: 'Password', placeholder: 'Your 99acres password', secure: true, required: true, group: 'credentials' },
    ],
  },
  { id: 'magicbricks', source_name: 'magicbricks', name: 'MagicBricks', description: 'Import leads from MagicBricks portal', icon: Building2, color: '#E53935', category: 'portal', available: true,
    fields: [
      { key: 'branch', label: 'Branch', placeholder: 'e.g., Delhi', required: true, group: 'meta' },
      { key: 'api_key', label: 'API Key', placeholder: 'Your MagicBricks API Key', secure: true, required: true, group: 'credentials' },
    ],
  },
  { id: 'housing', source_name: 'housing', name: 'Housing.com', description: 'Sync leads from Housing.com', icon: Building2, color: '#00C853', category: 'portal', available: true,
    fields: [
      { key: 'branch', label: 'Branch', placeholder: 'e.g., Bangalore', required: true, group: 'meta' },
      { key: 'housing_id', label: 'Housing ID', placeholder: 'Your Housing.com ID', required: true, group: 'credentials' },
      { key: 'housing_key', label: 'Housing Key', placeholder: 'Your Housing.com Key', secure: true, required: true, group: 'credentials' },
    ],
  },
  { id: 'website', source_name: 'website', name: 'Website / WordPress', description: 'Capture leads from your website forms', icon: Globe, color: '#2196F3', category: 'web', available: true,
    fields: [
      { key: 'branch', label: 'Branch', placeholder: 'e.g., Main', required: true, group: 'meta' },
      { key: 'api_key', label: 'API Key', placeholder: 'Your webhook API key', secure: true, required: true, group: 'credentials' },
    ],
  },
  { id: 'facebook', source_name: 'facebook', name: 'Facebook Leads', description: 'Auto-import leads from Facebook Lead Ads', icon: Globe, color: '#1877F2', category: 'social', available: false,
    fields: [],
  },
];

const findSourceMeta = (source_name) =>
  ALL_SOURCES.find(s => s.source_name?.toLowerCase() === String(source_name).toLowerCase());

export default function Integration() {
  const { showToast } = useToast();
  const { clientData } = useAuth();
  const clientCode = clientData?.clientCode || '202898';

  const [connected, setConnected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [selectedSource, setSelectedSource] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState(null);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [disconnectTarget, setDisconnectTarget] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const loadConnections = useCallback(async () => {
    if (!clientCode) return;
    setLoading(true);
    try {
      const r = await fetch(`${PROXY_BASE}/credentials/${encodeURIComponent(clientCode)}`);
      const data = await r.json();
      const list = Array.isArray(data?.sources) ? data.sources : [];
      const mapped = list.map(item => {
        const meta = findSourceMeta(item.source_name) || {};
        return {
          id: item.credential_id,
          credentialId: item.credential_id,
          sourceId: meta.id || item.source_name,
          source_name: item.source_name,
          name: meta.name || item.source_name,
          sourceName: `${meta.name || item.source_name} — ${item.branch}`,
          branch: item.branch,
          color: meta.color || '#6b7280',
          icon: meta.icon || Globe,
          leadsToday: 0,
          leadsTotal: 0,
          lastSync: '—',
          config: { branch: item.branch, ...(item.credentials || {}) },
        };
      });
      setConnected(mapped);
    } catch (err) {
      showToast('Failed to load integrations', 'error');
    } finally {
      setLoading(false);
    }
  }, [clientCode, showToast]);

  useEffect(() => { loadConnections(); }, [loadConnections]);

  const totalToday = connected.reduce((s, c) => s + (c.leadsToday || 0), 0);
  const totalAll = connected.reduce((s, c) => s + (c.leadsTotal || 0), 0);

  const filteredSources = ALL_SOURCES.filter(s => {
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleConnect = useCallback((source) => {
    setSelectedSource(source);
    setShowConnectModal(true);
  }, []);

  const handleSubmitConnect = useCallback(async (source, formData) => {
    if (!clientCode) {
      showToast('Client code not available', 'error');
      return;
    }
    const credentials = {};
    let branch = '';
    (source.fields || []).forEach(f => {
      if (f.group === 'meta' && f.key === 'branch') branch = formData[f.key];
      else if (f.group === 'credentials') credentials[f.key] = formData[f.key];
    });

    setSubmitting(true);
    try {
      const r = await fetch(`${PROXY_BASE}/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_code: clientCode,
          source_name: source.source_name,
          branch,
          credentials,
        }),
      });
      const data = await r.json();
      if (!r.ok || data?.success === false) {
        showToast(data?.message || 'Failed to connect', 'error');
        return;
      }
      showToast(`${source.name} connected successfully!`, 'success');
      setShowConnectModal(false);
      setSelectedSource(null);
      loadConnections();
    } catch (err) {
      showToast('Connection failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }, [clientCode, showToast, loadConnections]);

  const handleSync = useCallback((intg) => {
    showToast(`${intg.name} sync queued`, 'info');
  }, [showToast]);

  const confirmDisconnect = useCallback(async () => {
    if (!disconnectTarget || !clientCode) return;
    setSubmitting(true);
    try {
      const r = await fetch(`${PROXY_BASE}/credentials`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_code: clientCode,
          source_name: disconnectTarget.source_name,
          branch: disconnectTarget.branch,
        }),
      });
      const data = await r.json();
      if (!r.ok || data?.success === false) {
        showToast(data?.message || 'Failed to disconnect', 'error');
        return;
      }
      showToast(`${disconnectTarget.name} disconnected`, 'success');
      setShowDisconnectConfirm(false);
      setShowDetailsModal(false);
      setDisconnectTarget(null);
      loadConnections();
    } catch (err) {
      showToast('Disconnect failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }, [disconnectTarget, clientCode, showToast, loadConnections]);

  return (
    <div>
      <Header
        title="API Integrations"
        subtitle="Connect third-party platforms to auto-import leads"
      />
      <div className="page animate-fade-in">
        {/* Hero */}
        <div className="intg-hero">
          <div className="intg-hero__icon"><Link2 size={26} /></div>
          <div className="intg-hero__content">
            <h2 className="intg-hero__title">Lead Source Integrations</h2>
            <p className="intg-hero__sub">Connect third-party portals to auto-import leads into your pipeline.</p>
            <div className="intg-hero__chips">
              <span className="intg-hero__chip">
                <Link2 size={12} /> {connected.length} Connected
              </span>
              <span className="intg-hero__chip">
                <Zap size={12} /> {totalToday} Today
              </span>
              <span className="intg-hero__chip">
                <CheckCircle size={12} /> {totalAll} Total Leads
              </span>
            </div>
          </div>
        </div>

        {/* Connected */}
        {loading ? (
          <div className="intg-loading animate-fade-in">
            <Loader size={28} className="intg-spin" />
            <p>Loading integrations...</p>
          </div>
        ) : connected.length > 0 && (
          <div className="intg-section-card">
            <div className="intg-section__head">
              <h2 className="intg-section__title"><CheckCircle size={13} /> Active Connections · {connected.length}</h2>
            </div>
            <div className="intg-connected">
              {connected.map(intg => {
                const IC = intg.icon;
                return (
                  <div key={intg.id} className="intg-card intg-card--colored"
                    style={{ borderLeftColor: intg.color }}
                    onClick={() => { setSelectedIntegration(intg); setShowDetailsModal(true); }}>
                    <div className="intg-card__top">
                      <div className="intg-card__icon" style={{ backgroundColor: intg.color + '12' }}>
                        <IC size={22} style={{ color: intg.color }} />
                      </div>
                      <div className="intg-card__info">
                        <span className="intg-card__name">{intg.name}</span>
                        <span className="intg-card__badge"><CheckCircle size={11} /> {intg.branch}</span>
                      </div>
                      <button className="intg-card__sync" title="Sync Now"
                        onClick={(e) => { e.stopPropagation(); handleSync(intg); }}>
                        <RefreshCw size={15} />
                      </button>
                    </div>
                    <div className="intg-card__stats">
                      <div className="intg-card__stat">
                        <span className="intg-card__stat-val intg-card__stat-val--accent">{intg.leadsToday}</span>
                        <span className="intg-card__stat-lbl">Today</span>
                      </div>
                      <div className="intg-card__divider" />
                      <div className="intg-card__stat">
                        <span className="intg-card__stat-val">{intg.leadsTotal}</span>
                        <span className="intg-card__stat-lbl">Total</span>
                      </div>
                      <div className="intg-card__divider" />
                      <div className="intg-card__stat intg-card__stat--sync">
                        <Clock size={11} />
                        <span className="intg-card__stat-lbl">{intg.lastSync}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Available Sources */}
        <div className="intg-section-card">
          <div className="intg-section__head">
            <h2 className="intg-section__title"><Plus size={13} /> Available Integrations</h2>
          </div>
          <div className="intg-filters">
            <div className="intg-search">
              <Search size={16} />
              <input placeholder="Search integrations..." value={search} onChange={(e) => setSearch(e.target.value)} />
              {search && <button onClick={() => setSearch('')}><X size={14} /></button>}
            </div>
          </div>
          <div className="intg-sources">
            {filteredSources.map(source => {
              const IC = source.icon;
              return (
                <div key={source.id}
                  className={`intg-source ${!source.available ? 'intg-source--disabled' : ''}`}
                  onClick={() => source.available && handleConnect(source)}>
                  <div className="intg-source__icon" style={{ backgroundColor: source.color + '10' }}>
                    <IC size={20} style={{ color: source.color }} />
                  </div>
                  <div className="intg-source__info">
                    <span className="intg-source__name">{source.name}</span>
                    <span className="intg-source__desc">{source.description}</span>
                  </div>
                  {source.available ? (
                    <button className="intg-source__btn">
                      <Plus size={13} /> Connect
                    </button>
                  ) : (
                    <span className="intg-source__soon">Coming Soon</span>
                  )}
                </div>
              );
            })}
            {filteredSources.length === 0 && (
              <div className="intg-empty"><Search size={36} /><p>No integrations found</p></div>
            )}
          </div>
        </div>
      </div>

      {/* Connect Form Modal */}
      <ConnectFormModal isOpen={showConnectModal} source={selectedSource} submitting={submitting}
        onClose={() => { setShowConnectModal(false); setSelectedSource(null); }}
        onSubmit={handleSubmitConnect} />

      {/* Details Modal */}
      <DetailsModal isOpen={showDetailsModal} integration={selectedIntegration}
        onClose={() => { setShowDetailsModal(false); setSelectedIntegration(null); }}
        onSync={handleSync}
        onDisconnect={(intg) => { setDisconnectTarget(intg); setShowDisconnectConfirm(true); }} />

      {/* Disconnect Confirm */}
      <Modal isOpen={showDisconnectConfirm} onClose={() => setShowDisconnectConfirm(false)} title="Disconnect Integration" size="sm">
        <div className="intg-disconnect">
          <AlertCircle size={40} className="intg-disconnect__icon" />
          <p>Are you sure you want to disconnect <strong>{disconnectTarget?.name}</strong> ({disconnectTarget?.branch})?</p>
          <p className="intg-disconnect__sub">Lead syncing will stop immediately. Existing leads won't be affected.</p>
          <div className="intg-disconnect__actions">
            <Button variant="ghost" onClick={() => setShowDisconnectConfirm(false)} disabled={submitting}>Cancel</Button>
            <Button variant="danger" onClick={confirmDisconnect} disabled={submitting}>
              {submitting ? 'Disconnecting...' : 'Disconnect'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ── Connect Form Modal ── */
function ConnectFormModal({ isOpen, source, submitting, onClose, onSubmit }) {
  const [formData, setFormData] = useState({});
  const [showSecure, setShowSecure] = useState({});
  const [errors, setErrors] = useState({});
  const { showToast } = useToast();

  React.useEffect(() => {
    if (source) { setFormData({}); setShowSecure({}); setErrors({}); }
  }, [source]);

  if (!isOpen || !source) return null;
  const IC = source.icon;

  const handleChange = (key, val) => {
    setFormData(p => ({ ...p, [key]: val }));
    if (errors[key]) setErrors(p => ({ ...p, [key]: null }));
  };

  const handleSubmit = () => {
    const errs = {};
    (source.fields || []).forEach(f => {
      if (f.required && (!formData[f.key] || String(formData[f.key]).trim() === ''))
        errs[f.key] = `${f.label} is required`;
    });
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      showToast(Object.values(errs)[0], 'error');
      return;
    }
    onSubmit(source, formData);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="intg-form-modal animate-scale-in" onClick={e => e.stopPropagation()}>
        <div className="intg-form__header">
          <div className="intg-form__header-left">
            <div className="intg-form__icon" style={{ backgroundColor: source.color + '12' }}>
              <IC size={22} style={{ color: source.color }} />
            </div>
            <div>
              <h3 className="intg-form__title">Connect {source.name}</h3>
              <p className="intg-form__sub">Enter your account details</p>
            </div>
          </div>
          <button className="modal__close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="intg-form__banner" style={{ backgroundColor: source.color + '06', borderColor: source.color + '25' }}>
          <AlertCircle size={15} style={{ color: source.color, flexShrink: 0 }} />
          <span style={{ color: source.color }}>Get these details from your {source.name} dashboard</span>
        </div>

        <div className="intg-form__body">
          {(source.fields || []).map(field => (
            <div key={field.key} className="intg-form__field">
              <label className="intg-form__label">
                {field.label} {field.required && <span className="intg-form__req">*</span>}
              </label>
              <div className={`intg-form__input-wrap ${errors[field.key] ? 'intg-form__input-wrap--error' : ''}`}>
                <input
                  type={field.secure && !showSecure[field.key] ? 'password' : 'text'}
                  className="intg-form__input"
                  placeholder={field.placeholder}
                  value={formData[field.key] || ''}
                  onChange={e => handleChange(field.key, e.target.value)}
                />
                {field.secure && (
                  <button className="intg-form__eye" type="button"
                    onClick={() => setShowSecure(p => ({ ...p, [field.key]: !p[field.key] }))}>
                    {showSecure[field.key] ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                )}
              </div>
              {errors[field.key] && <span className="intg-form__error">{errors[field.key]}</span>}
            </div>
          ))}
        </div>

        <div className="intg-form__actions">
          <button className="intg-form__cancel" onClick={onClose} disabled={submitting}>Cancel</button>
          <button className="intg-form__submit" onClick={handleSubmit} disabled={submitting}>
            <Zap size={15} /> {submitting ? 'Connecting...' : 'Connect'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Details Modal ── */
function DetailsModal({ isOpen, integration, onClose, onSync, onDisconnect }) {
  if (!isOpen || !integration) return null;
  const IC = integration.icon;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="intg-det-modal animate-scale-in" onClick={e => e.stopPropagation()}>
        <div className="intg-det__header">
          <div className="intg-det__header-left">
            <div className="intg-det__icon" style={{ backgroundColor: integration.color + '12' }}>
              <IC size={26} style={{ color: integration.color }} />
            </div>
            <div>
              <h3 className="intg-det__name">{integration.name}</h3>
              <p className="intg-det__source">{integration.sourceName}</p>
            </div>
          </div>
          <button className="modal__close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="intg-det__status">
          <CheckCircle size={18} />
          <div>
            <span className="intg-det__status-title">Connected & Active</span>
            <span className="intg-det__status-sub">Branch: {integration.branch}</span>
          </div>
        </div>

        <div className="intg-det__stats">
          <div className="intg-det__stat intg-det__stat--accent">
            <span className="intg-det__stat-val">{integration.leadsToday}</span>
            <span className="intg-det__stat-lbl">Today</span>
          </div>
          <div className="intg-det__stat intg-det__stat--info">
            <span className="intg-det__stat-val">{integration.leadsTotal}</span>
            <span className="intg-det__stat-lbl">Total Leads</span>
          </div>
        </div>

        <h4 className="intg-det__cfg-title">Connection Details</h4>
        <div className="intg-det__cfg">
          {Object.entries(integration.config || {}).map(([k, v]) => (
            <div key={k} className="intg-det__cfg-row">
              <span className="intg-det__cfg-key">
                {k.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())}
              </span>
              <span className="intg-det__cfg-val">
                {k.toLowerCase().includes('key') || k.toLowerCase().includes('token') || k.toLowerCase().includes('secret') || k.toLowerCase().includes('password')
                  ? '••••••••' + String(v).slice(-4) : v}
              </span>
            </div>
          ))}
        </div>

        <div className="intg-det__actions">
          <button className="intg-det__act intg-det__act--sync"
            onClick={() => { onSync(integration); onClose(); }}>
            <RefreshCw size={15} /> Sync Now
          </button>
          <button className="intg-det__act intg-det__act--danger"
            onClick={() => onDisconnect(integration)}>
            <Trash2 size={15} /> Disconnect
          </button>
        </div>
      </div>
    </div>
  );
}
