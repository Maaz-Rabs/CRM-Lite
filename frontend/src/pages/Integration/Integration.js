import React, { useState, useCallback } from 'react';
import {
  Link2, Building2, Globe,
  Plus, RefreshCw, Zap, CheckCircle, Clock, Trash2, Eye, EyeOff,
  AlertCircle, Search, X
} from 'lucide-react';
import Header from '../../components/layout/Header';
import { Modal, Button } from '../../components/common/Common';
import { useToast } from '../../context/ToastContext';
import './Integration.css';

const ALL_SOURCES = [
  { id: '99acres', name: '99acres', description: 'Import property inquiries from 99acres', icon: Building2, color: '#FF6B35', category: 'portal', available: true,
    fields: [
      { key: 'clientId', label: 'Client ID', placeholder: 'Enter your 99acres Client ID', required: true },
      { key: 'apiKey', label: 'API Key', placeholder: 'Enter your 99acres API Key', secure: true, required: true },
      { key: 'email', label: 'Registered Email', placeholder: 'Enter registered email', type: 'email', required: true },
      { key: 'autoSync', label: 'Auto Sync Interval (mins)', placeholder: '15', type: 'number' },
    ],
  },
  { id: 'magicbricks', name: 'MagicBricks', description: 'Import leads from MagicBricks portal', icon: Building2, color: '#E53935', category: 'portal', available: true,
    fields: [
      { key: 'accountId', label: 'Account ID', placeholder: 'Enter your MagicBricks Account ID', required: true },
      { key: 'apiKey', label: 'Secret Key', placeholder: 'Enter your MagicBricks Secret Key', secure: true, required: true },
      { key: 'email', label: 'Registered Email', placeholder: 'Enter registered email', type: 'email', required: true },
      { key: 'phone', label: 'Registered Mobile', placeholder: 'Enter registered mobile number', type: 'phone' },
      { key: 'autoSync', label: 'Auto Sync Interval (mins)', placeholder: '15', type: 'number' },
    ],
  },
  { id: 'housing', name: 'Housing.com', description: 'Sync leads from Housing.com', icon: Building2, color: '#00C853', category: 'portal', available: true,
    fields: [
      { key: 'sellerId', label: 'Seller ID', placeholder: 'Enter your Housing.com Seller ID', required: true },
      { key: 'apiToken', label: 'API Token', placeholder: 'Enter your Housing.com API Token', secure: true, required: true },
      { key: 'email', label: 'Registered Email', placeholder: 'Enter registered email', type: 'email', required: true },
      { key: 'autoSync', label: 'Auto Sync Interval (mins)', placeholder: '15', type: 'number' },
    ],
  },
  { id: 'facebook', name: 'Facebook Leads', description: 'Auto-import leads from Facebook Lead Ads', icon: Globe, color: '#1877F2', category: 'social', available: true,
    fields: [
      { key: 'pageId', label: 'Page ID', placeholder: 'Enter your Facebook Page ID', required: true },
      { key: 'accessToken', label: 'Access Token', placeholder: 'Enter your long-lived access token', secure: true, required: true },
      { key: 'formId', label: 'Lead Form ID', placeholder: 'Enter Lead Ad Form ID (optional)' },
      { key: 'autoSync', label: 'Auto Sync Interval (mins)', placeholder: '15', type: 'number' },
    ],
  },
  { id: 'website', name: 'Website / WordPress / Microsite', description: 'Capture leads from your website, WordPress or microsite contact forms', icon: Globe, color: '#2196F3', category: 'web', available: true,
    fields: [
      { key: 'websiteUrl', label: 'Website URL', placeholder: 'https://yourwebsite.com', required: true },
      { key: 'apiKey', label: 'API Key', placeholder: 'Your webhook API key', secure: true, required: true },
      { key: 'webhookUrl', label: 'Webhook URL (auto-generated)', placeholder: 'Will be generated after connection', type: 'text' },
      { key: 'formSelector', label: 'Form Selector (CSS)', placeholder: '#contact-form or .lead-form' },
    ],
  },
];

const DEMO_CONNECTED = [
  { id: 1, sourceId: '99acres', name: '99acres', sourceName: '99acres Portal', color: '#FF6B35', icon: Building2, leadsToday: 8, leadsTotal: 234, lastSync: '2 min ago',
    config: { clientId: 'RABS_99A_4821', apiKey: 'sk_live_xxxxxxxxxxxxx4821', email: 'leads@rabsconnect.com', autoSync: '15' } },
  { id: 2, sourceId: 'magicbricks', name: 'MagicBricks', sourceName: 'MagicBricks Portal', color: '#E53935', icon: Building2, leadsToday: 6, leadsTotal: 189, lastSync: '5 min ago',
    config: { accountId: 'MB_RABS_9920', apiKey: 'sk_mb_xxxxxxxxxxxxx9920', email: 'sales@rabsconnect.com', phone: '9876543210', autoSync: '15' } },
];

export default function Integration() {
  const { showToast } = useToast();
  const [connected, setConnected] = useState(DEMO_CONNECTED);
  const [search, setSearch] = useState('');
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [selectedSource, setSelectedSource] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState(null);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [disconnectTarget, setDisconnectTarget] = useState(null);

  const totalToday = connected.reduce((s, c) => s + c.leadsToday, 0);
  const totalAll = connected.reduce((s, c) => s + c.leadsTotal, 0);

  const connectedIds = connected.map(c => c.sourceId);
  const filteredSources = ALL_SOURCES.filter(s => {
    if (connectedIds.includes(s.id)) return false;
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleConnect = useCallback((source) => {
    setSelectedSource(source);
    setShowConnectModal(true);
  }, []);

  const handleSubmitConnect = useCallback((source, formData) => {
    setConnected(prev => [...prev, {
      id: Date.now(), sourceId: source.id, name: source.name,
      sourceName: `${source.name} Portal`, color: source.color, icon: source.icon,
      leadsToday: 0, leadsTotal: 0, lastSync: 'Just now', config: formData,
    }]);
    setShowConnectModal(false);
    setSelectedSource(null);
    showToast(`${source.name} connected successfully!`, 'success');
  }, [showToast]);

  const handleSync = useCallback((intg) => {
    showToast(`${intg.name} is being synced...`, 'info');
  }, [showToast]);

  const confirmDisconnect = useCallback(() => {
    setConnected(prev => prev.filter(c => c.id !== disconnectTarget.id));
    setShowDisconnectConfirm(false);
    setShowDetailsModal(false);
    showToast(`${disconnectTarget.name} disconnected`, 'success');
    setDisconnectTarget(null);
  }, [disconnectTarget, showToast]);

  return (
    <div>
      <Header
        title="API Integrations"
        subtitle="Connect third-party platforms to auto-import leads"
      />
      <div className="page">
        {/* Stats */}
        <div className="intg-stats">
          <div className="intg-stat-card intg-stat-card--gold">
            <div className="intg-stat-card__icon intg-stat-card__icon--gold"><Link2 size={20} /></div>
            <div>
              <div className="intg-stat-card__val">{connected.length}</div>
              <div className="intg-stat-card__lbl">Connected Sources</div>
            </div>
          </div>
          <div className="intg-stat-card intg-stat-card--green">
            <div className="intg-stat-card__icon intg-stat-card__icon--green"><Zap size={20} /></div>
            <div>
              <div className="intg-stat-card__val">{totalToday}</div>
              <div className="intg-stat-card__lbl">Leads Today</div>
            </div>
          </div>
          <div className="intg-stat-card intg-stat-card--blue">
            <div className="intg-stat-card__icon intg-stat-card__icon--blue"><CheckCircle size={20} /></div>
            <div>
              <div className="intg-stat-card__val">{totalAll}</div>
              <div className="intg-stat-card__lbl">Total Leads Imported</div>
            </div>
          </div>
        </div>

        {/* Connected */}
        {connected.length > 0 && (
          <div className="intg-section">
            <div className="intg-section__head">
              <h2 className="intg-section__title"><CheckCircle size={16} /> Active Connections ({connected.length})</h2>
            </div>
            <div className="intg-connected">
              {connected.map(intg => {
                const IC = intg.icon;
                return (
                  <div key={intg.id} className="intg-card" onClick={() => { setSelectedIntegration(intg); setShowDetailsModal(true); }}>
                    <div className="intg-card__top">
                      <div className="intg-card__icon" style={{ backgroundColor: intg.color + '12' }}>
                        <IC size={22} style={{ color: intg.color }} />
                      </div>
                      <div className="intg-card__info">
                        <span className="intg-card__name">{intg.name}</span>
                        <span className="intg-card__badge"><CheckCircle size={11} /> Active</span>
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
        <div className="intg-section">
          <div className="intg-section__head">
            <h2 className="intg-section__title"><Plus size={16} /> Available Integrations</h2>
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
                    <button className="intg-source__btn" style={{ backgroundColor: source.color }}>
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
      <ConnectFormModal isOpen={showConnectModal} source={selectedSource}
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
          <p>Are you sure you want to disconnect <strong>{disconnectTarget?.name}</strong>?</p>
          <p className="intg-disconnect__sub">Lead syncing will stop immediately. Existing leads won't be affected.</p>
          <div className="intg-disconnect__actions">
            <Button variant="ghost" onClick={() => setShowDisconnectConfirm(false)}>Cancel</Button>
            <Button variant="danger" onClick={confirmDisconnect}>Disconnect</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ── Connect Form Modal ── */
function ConnectFormModal({ isOpen, source, onClose, onSubmit }) {
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
      if (f.required && (!formData[f.key] || formData[f.key].trim() === ''))
        errs[f.key] = `${f.label} is required`;
      if (f.type === 'email' && formData[f.key] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData[f.key]))
        errs[f.key] = 'Invalid email address';
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
                  type={field.secure && !showSecure[field.key] ? 'password' : field.type === 'number' ? 'number' : 'text'}
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
          <button className="intg-form__cancel" onClick={onClose}>Cancel</button>
          <button className="intg-form__submit" style={{ backgroundColor: source.color }} onClick={handleSubmit}>
            <Zap size={15} /> Connect
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
            <span className="intg-det__status-sub">Last synced: {integration.lastSync}</span>
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
                {k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase())}
              </span>
              <span className="intg-det__cfg-val">
                {k.toLowerCase().includes('key') || k.toLowerCase().includes('token') || k.toLowerCase().includes('secret')
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
