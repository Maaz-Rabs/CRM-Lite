import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import Header from '../../components/layout/Header';
import { useToast } from '../../context/ToastContext';
import { apiFetch } from '../../utils/api';
import {
  MapPin, Clock, Phone, MessageSquare, Navigation, RefreshCw, Users,
  Wifi, WifiOff, Battery, BatteryLow, BatteryMedium, BatteryFull, BatteryWarning,
  Crosshair, Search, X, Layers, Maximize2, ChevronDown, ChevronUp, CheckCircle
} from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import './TrackUser.css';

const COLORS = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336', '#00BCD4', '#FF5722', '#607D8B', '#E91E63', '#009688'];

const getTimeSince = (dt) => {
  if (!dt) return 'No data';
  const mins = Math.floor((Date.now() - new Date(dt)) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const getBattery = (lvl) => {
  if (lvl == null) return { Icon: Battery, color: '#9e9e9e', text: '--' };
  if (lvl > 60) return { Icon: BatteryFull, color: '#4CAF50', text: `${lvl}%` };
  if (lvl > 30) return { Icon: BatteryMedium, color: '#FF9800', text: `${lvl}%` };
  if (lvl > 15) return { Icon: BatteryLow, color: '#F44336', text: `${lvl}%` };
  return { Icon: BatteryWarning, color: '#F44336', text: `${lvl}%` };
};

// Create custom marker icon
const createMarkerIcon = (color, initials, isOnline) => {
  const svg = `<svg width="40" height="50" viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 48 C20 48 2 30 2 18 C2 8.06 10.06 0 20 0 C29.94 0 38 8.06 38 18 C38 30 20 48 20 48Z" fill="${color}" stroke="white" stroke-width="2"/>
    <circle cx="20" cy="18" r="12" fill="white"/>
    <text x="20" y="23" text-anchor="middle" fill="${color}" font-size="12" font-weight="700" font-family="sans-serif">${initials}</text>
    ${isOnline ? '<circle cx="32" cy="6" r="5" fill="#4CAF50" stroke="white" stroke-width="2"/>' : ''}
  </svg>`;
  return L.divIcon({
    html: svg,
    className: 'track-marker',
    iconSize: [40, 50],
    iconAnchor: [20, 50],
    popupAnchor: [0, -45],
  });
};

// Component to fit bounds
function FitBounds({ members }) {
  const map = useMap();
  useEffect(() => {
    if (members.length > 0) {
      const bounds = L.latLngBounds(members.map(m => [m.location.latitude, m.location.longitude]));
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [members.length]);
  return null;
}

// Component to fly to user
function FlyToUser({ user }) {
  const map = useMap();
  useEffect(() => {
    if (user?.location) {
      map.flyTo([user.location.latitude, user.location.longitude], 15, { duration: 0.8 });
    }
  }, [user]);
  return null;
}

export default function TrackUser() {
  const { showToast } = useToast();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showList, setShowList] = useState(true);
  const [requestingId, setRequestingId] = useState(null);
  const [mapLayer, setMapLayer] = useState('street');
  const mapRef = useRef(null);

  const fetchTeam = useCallback(async () => {
    try {
      const res = await apiFetch('location/team');
      if (res.success && res.data?.members) {
        setMembers(res.data.members.map((m, i) => ({
          ...m,
          color: COLORS[i % COLORS.length],
          lastSeen: m.location ? getTimeSince(m.location.tracked_at) : 'No data',
        })));
      }
    } catch (err) {
      console.error('Fetch team error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeam();
    const interval = setInterval(fetchTeam, 30000);
    return () => clearInterval(interval);
  }, [fetchTeam]);

  const handleRequestLocation = async (user) => {
    setRequestingId(user.id);
    try {
      const res = await apiFetch('location/request', {
        method: 'POST',
        body: JSON.stringify({ target_user_id: parseInt(user.id) }),
      });
      if (res.success) showToast(`Location request sent to ${user.name}`, 'success');
      else showToast(res.message || 'Failed to send request', 'error');
    } catch { showToast('Failed to send request', 'error'); }
    finally { setTimeout(() => setRequestingId(null), 3000); }
  };

  const onlineCount = members.filter(m => m.status === 'online').length;
  const membersWithLocation = members.filter(m => m.location && m.status === 'online');

  const filtered = members.filter(m => {
    if (filter === 'online' && m.status !== 'online') return false;
    if (filter === 'offline' && m.status !== 'offline') return false;
    if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const tileUrl = mapLayer === 'satellite'
    ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
    : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  return (
    <div>
      <Header title="Track Team" subtitle={`${onlineCount} of ${members.length} team members online`} />

      <div className="page track-page">
        {/* Stats strip */}
        <div className="track-stats">
          <div className="track-stat">
            <Users size={16} />
            <span className="track-stat__val">{members.length}</span>
            <span className="track-stat__lbl">Total</span>
          </div>
          <div className="track-stat track-stat--online">
            <Wifi size={16} />
            <span className="track-stat__val">{onlineCount}</span>
            <span className="track-stat__lbl">Online</span>
          </div>
          <div className="track-stat track-stat--offline">
            <WifiOff size={16} />
            <span className="track-stat__val">{members.length - onlineCount}</span>
            <span className="track-stat__lbl">Offline</span>
          </div>
          <div className="track-stat track-stat--located">
            <MapPin size={16} />
            <span className="track-stat__val">{membersWithLocation.length}</span>
            <span className="track-stat__lbl">On Map</span>
          </div>
        </div>

        <div className="track-layout">
          {/* Map */}
          <div className="track-map-wrap">
            <MapContainer
              ref={mapRef}
              center={[19.1, 72.84]}
              zoom={11}
              className="track-map"
              zoomControl={false}
            >
              <TileLayer url={tileUrl} attribution='&copy; OpenStreetMap' />
              <FitBounds members={membersWithLocation} />
              {selectedUser?.location && <FlyToUser user={selectedUser} />}

              {membersWithLocation.map(user => (
                <Marker
                  key={user.id}
                  position={[user.location.latitude, user.location.longitude]}
                  icon={createMarkerIcon(user.color, user.avatar, true)}
                  eventHandlers={{ click: () => setSelectedUser(user) }}
                >
                  <Popup>
                    <div className="track-popup">
                      <strong>{user.name}</strong>
                      <span className="track-popup__role">{user.role}</span>
                      <span className="track-popup__addr">{user.location.address}</span>
                      <span className="track-popup__time">{user.lastSeen}</span>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {selectedUser?.location && (
                <Circle
                  center={[selectedUser.location.latitude, selectedUser.location.longitude]}
                  radius={150}
                  pathOptions={{ color: selectedUser.color, fillColor: selectedUser.color, fillOpacity: 0.1, weight: 2 }}
                />
              )}
            </MapContainer>

            {/* Map Controls */}
            <div className="track-controls">
              <button className="track-ctrl-btn" title="Fit all markers" onClick={() => {
                if (mapRef.current && membersWithLocation.length > 0) {
                  const bounds = L.latLngBounds(membersWithLocation.map(m => [m.location.latitude, m.location.longitude]));
                  mapRef.current.fitBounds(bounds, { padding: [40, 40] });
                }
              }}><Maximize2 size={16} /></button>
              <button className="track-ctrl-btn" title="Toggle map style" onClick={() => setMapLayer(p => p === 'street' ? 'satellite' : 'street')}>
                <Layers size={16} />
              </button>
              <button className="track-ctrl-btn" title="Refresh" onClick={fetchTeam}><RefreshCw size={16} /></button>
            </div>
          </div>

          {/* User List Panel */}
          <div className={`track-panel ${!showList ? 'track-panel--collapsed' : ''}`}>
            <div className="track-panel__header">
              <h3>Team Members</h3>
              <button className="track-panel__toggle" onClick={() => setShowList(!showList)}>
                {showList ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
              </button>
            </div>

            {showList && (
              <>
                {/* Search */}
                <div className="track-search">
                  <Search size={14} />
                  <input placeholder="Search member..." value={search} onChange={e => setSearch(e.target.value)} />
                  {search && <button onClick={() => setSearch('')}><X size={12} /></button>}
                </div>

                {/* Filters */}
                <div className="track-filters">
                  {[
                    { key: 'all', label: 'All', count: members.length },
                    { key: 'online', label: 'Online', count: onlineCount },
                    { key: 'offline', label: 'Offline', count: members.length - onlineCount },
                  ].map(f => (
                    <button key={f.key} className={`track-filter ${filter === f.key ? 'track-filter--active' : ''}`}
                      onClick={() => setFilter(f.key)}>
                      {f.label} <span>{f.count}</span>
                    </button>
                  ))}
                </div>

                {/* List */}
                <div className="track-list">
                  {filtered.length === 0 ? (
                    <div className="track-empty"><Users size={32} /><p>No members found</p></div>
                  ) : filtered.map(user => {
                    const isOnline = user.status === 'online';
                    const isSelected = selectedUser?.id === user.id;
                    const bat = getBattery(user.location?.battery_level);
                    const BatIcon = bat.Icon;

                    return (
                      <div key={user.id}
                        className={`track-card ${isSelected ? 'track-card--selected' : ''}`}
                        onClick={() => setSelectedUser(isSelected ? null : user)}>
                        {/* Top row */}
                        <div className="track-card__top">
                          <div className="track-card__avatar" style={{ backgroundColor: user.color + '18', color: user.color }}>
                            {user.avatar}
                            <span className={`track-card__dot ${isOnline ? 'track-card__dot--on' : ''}`} />
                          </div>
                          <div className="track-card__info">
                            <span className="track-card__name">{user.name}</span>
                            <span className="track-card__role">{user.role}</span>
                          </div>
                          <div className="track-card__badges">
                            <span className={`track-badge ${isOnline ? 'track-badge--online' : 'track-badge--offline'}`}>
                              {isOnline ? <Wifi size={11} /> : <WifiOff size={11} />}
                              {isOnline ? 'Online' : 'Offline'}
                            </span>
                            <span className="track-badge" style={{ color: bat.color, background: bat.color + '12' }}>
                              <BatIcon size={12} /> {bat.text}
                            </span>
                          </div>
                        </div>

                        {/* Location */}
                        <div className="track-card__loc">
                          <div className="track-card__loc-row">
                            <MapPin size={13} style={{ color: isOnline ? '#d4a819' : '#9e9e9e' }} />
                            <span>{user.location ? user.location.address : 'No location data'}</span>
                          </div>
                          <div className="track-card__loc-row">
                            <Clock size={13} />
                            <span>{user.lastSeen}</span>
                          </div>
                          {user.isPunchedIn && (
                            <div className="track-card__loc-row track-card__loc-row--punch">
                              <CheckCircle size={13} />
                              <span>Punched In</span>
                            </div>
                          )}
                        </div>

                        {/* Actions (expanded) */}
                        {isSelected && (
                          <div className="track-card__actions">
                            {user.phone && (
                              <>
                                <a href={`tel:${user.phone}`} className="track-act track-act--call" onClick={e => e.stopPropagation()}>
                                  <Phone size={14} /> Call
                                </a>
                                <a href={`https://wa.me/${user.phone}`} target="_blank" rel="noreferrer"
                                  className="track-act track-act--msg" onClick={e => e.stopPropagation()}>
                                  <MessageSquare size={14} /> WhatsApp
                                </a>
                              </>
                            )}
                            {user.location && (
                              <a href={`https://www.google.com/maps/search/?api=1&query=${user.location.latitude},${user.location.longitude}`}
                                target="_blank" rel="noreferrer" className="track-act track-act--nav" onClick={e => e.stopPropagation()}>
                                <Navigation size={14} /> Navigate
                              </a>
                            )}
                            <button className="track-act track-act--req"
                              disabled={requestingId === user.id}
                              onClick={(e) => { e.stopPropagation(); handleRequestLocation(user); }}>
                              {requestingId === user.id ? <RefreshCw size={14} className="spin" /> : <Crosshair size={14} />}
                              {requestingId === user.id ? 'Requesting...' : 'Request Location'}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
