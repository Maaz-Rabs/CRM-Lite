import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Eye, Building2, MapPin, Calendar, Phone, MessageCircle, X, AlertTriangle, Image as ImageIcon } from 'lucide-react';
import './SharedView.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const SharedView = () => {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lightboxImg, setLightboxImg] = useState(null);

  useEffect(() => {
    const fetchSharedContent = async () => {
      try {
        const res = await fetch(`${API_BASE}/share/shared/${token}`, {
          headers: { 'x-client-db': getDbFromUrl() },
        });
        const json = await res.json();

        if (!json.success) {
          setError(json.message || 'This link is no longer available.');
        } else {
          setData(json.data);
        }
      } catch (err) {
        console.error('Shared fetch error:', err);
        setError('Failed to load shared content. Please try again later.');
      }
      setLoading(false);
    };

    fetchSharedContent();
  }, [token]);

  // Try to extract db name from URL query params or use default
  function getDbFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('db') || localStorage.getItem('rabs_shared_db') || process.env.REACT_APP_DB_NAME || 'rabsconnect_aarohan';
  }

  const formatPrice = (price) => {
    if (!price) return null;
    const n = Number(price);
    if (n >= 10000000) return '\u20B9' + (n / 10000000).toFixed(2) + ' Cr';
    if (n >= 100000) return '\u20B9' + (n / 100000).toFixed(2) + ' L';
    return '\u20B9' + n.toLocaleString('en-IN');
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // ── Loading state ──
  if (loading) {
    return (
      <div className="sv__loading">
        <div className="sv__spinner" />
      </div>
    );
  }

  // ── Error state ──
  if (error) {
    return (
      <div className="sv__error">
        <div className="sv__error-card">
          <div className="sv__error-icon">
            <AlertTriangle size={28} />
          </div>
          <h2 className="sv__error-title">Link Unavailable</h2>
          <p className="sv__error-text">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const isProject = data.entity_type === 'project';
  const entity = isProject ? data.project : data.property;
  const mediaList = entity?.media || [];
  const coverMedia = mediaList.find(m => m.is_cover) || mediaList[0];
  const coverUrl = coverMedia?.file_url || coverMedia?.url || null;
  const galleryMedia = mediaList.filter(m => {
    const url = m.file_url || m.url || '';
    return /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(url) || (m.type || '').startsWith('image');
  });

  return (
    <div className="sv">
      {/* Header */}
      <header className="sv__header">
        <div className="sv__header-inner">
          <div className="sv__brand">
            <div className="sv__brand-icon">R</div>
            <div>
              <div className="sv__brand-name">RABS Connect</div>
              <div className="sv__brand-sub">CRM Platform</div>
            </div>
          </div>
          <div className="sv__view-badge">
            <Eye size={14} />
            {data.view_count || 0} views
          </div>
        </div>
      </header>

      {/* Hero / Cover Image */}
      <div className="sv__hero">
        <div className="sv__cover">
          {coverUrl ? (
            <img src={coverUrl} alt="Cover" />
          ) : (
            <div className="sv__cover-placeholder">
              <ImageIcon size={48} />
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="sv__content">
        {/* Title Section */}
        <div className="sv__title-section">
          <h1 className="sv__title">
            {isProject ? entity.name : (entity.title || 'Property')}
          </h1>
          <p className="sv__subtitle">
            {isProject ? (
              <>
                {entity.developer && <span>{entity.developer}</span>}
                {entity.developer && (entity.city || entity.location) && <span> &middot; </span>}
                {(entity.city || entity.location) && (
                  <><MapPin size={13} /> {entity.city || entity.location}</>
                )}
              </>
            ) : (
              <>
                {entity.project_name && (
                  <><Building2 size={13} /> {entity.project_name}</>
                )}
                {entity.project_name && entity.location && <span> &middot; </span>}
                {entity.location && (
                  <><MapPin size={13} /> {entity.location}</>
                )}
              </>
            )}
          </p>

          <div className="sv__badges">
            {isProject ? (
              <>
                {entity.project_type && <span className="sv__badge sv__badge--type">{entity.project_type}</span>}
                {entity.construction_status && <span className="sv__badge sv__badge--status">{entity.construction_status}</span>}
              </>
            ) : (
              <>
                {entity.property_type && <span className="sv__badge sv__badge--type">{entity.property_type}</span>}
                {entity.configuration && <span className="sv__badge sv__badge--type">{entity.configuration}</span>}
                {entity.status && <span className="sv__badge sv__badge--status">{entity.status}</span>}
                {entity.price && <span className="sv__badge sv__badge--price">{formatPrice(entity.price)}</span>}
              </>
            )}
          </div>
        </div>

        <div className="sv__grid">
          {/* Left / Main */}
          <div>
            {/* Info Grid */}
            <div className="sv__section">
              <h3 className="sv__section-title">
                {isProject ? 'Project Information' : 'Property Details'}
              </h3>
              <div className="sv__info-grid">
                {isProject ? (
                  <>
                    {renderInfo('Developer', entity.developer)}
                    {renderInfo('RERA Number', entity.rera_number)}
                    {renderInfo('Type', entity.project_type)}
                    {renderInfo('Status', entity.construction_status)}
                    {renderInfo('Possession Date', formatDate(entity.possession_date))}
                    {renderInfo('Total Towers', entity.total_towers)}
                    {renderInfo('Total Units', entity.total_units)}
                    {renderInfo('City', entity.city)}
                    {renderInfo('State', entity.state)}
                    {renderInfo('Pincode', entity.pincode)}
                  </>
                ) : (
                  <>
                    {renderInfo('Type', entity.property_type)}
                    {renderInfo('Configuration', entity.configuration)}
                    {renderInfo('Bedrooms', entity.bedrooms)}
                    {renderInfo('Bathrooms', entity.bathrooms)}
                    {renderInfo('Area', entity.area ? `${entity.area} ${entity.area_unit || 'sqft'}` : null)}
                    {renderInfo('Floor', entity.floor ? `${entity.floor}${entity.total_floors ? ' / ' + entity.total_floors : ''}` : null)}
                    {renderInfo('Furnishing', entity.furnishing)}
                    {renderInfo('Facing', entity.facing)}
                    {renderInfo('Project', entity.project_name)}
                    {renderInfo('Owner Type', entity.owner_type)}
                  </>
                )}
              </div>
            </div>

            {/* Location */}
            {(entity.address || entity.location || entity.city) && (
              <div className="sv__section">
                <h3 className="sv__section-title">
                  <MapPin size={16} /> Location
                </h3>
                <div className="sv__info-grid">
                  {renderInfo('Address', entity.address, true)}
                  {!isProject && renderInfo('Location', entity.location)}
                  {isProject && renderInfo('City', entity.city)}
                  {isProject && renderInfo('State', entity.state)}
                </div>
              </div>
            )}

            {/* Description */}
            {entity.description && (
              <div className="sv__section">
                <h3 className="sv__section-title">Description</h3>
                <p className="sv__description">{entity.description}</p>
              </div>
            )}

            {/* Gallery */}
            {galleryMedia.length > 1 && (
              <div className="sv__section">
                <h3 className="sv__section-title">
                  <ImageIcon size={16} /> Gallery ({galleryMedia.length})
                </h3>
                <div className="sv__gallery">
                  {galleryMedia.map((m, i) => {
                    const url = m.file_url || m.url;
                    return (
                      <div
                        key={m.media_id || m.id || i}
                        className="sv__gallery-item"
                        onClick={() => setLightboxImg(url)}
                      >
                        <img src={url} alt={`Gallery ${i + 1}`} />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar */}
          <div>
            {/* Price Card (property) */}
            {!isProject && entity.price && (
              <div className="sv__section" style={{ textAlign: 'center' }}>
                <span style={{ fontSize: 28, fontWeight: 800, color: '#0f172a' }}>
                  {formatPrice(entity.price)}
                </span>
                {entity.status && (
                  <div style={{ marginTop: 8 }}>
                    <span className="sv__badge sv__badge--status">{entity.status}</span>
                  </div>
                )}
              </div>
            )}

            {/* Amenities */}
            {renderAmenities(entity.amenities)}

            {/* CTA */}
            <div className="sv__cta">
              <h3>Interested?</h3>
              <p>Get in touch with us for more details about this {isProject ? 'project' : 'property'}.</p>
              <div className="sv__cta-buttons">
                <a href="tel:+919999999999" className="sv__cta-btn sv__cta-btn--primary">
                  <Phone size={16} /> Call Us
                </a>
                <a
                  href={`https://wa.me/919999999999?text=${encodeURIComponent(
                    `Hi, I'm interested in ${isProject ? entity.name : (entity.title || 'this property')}. Please share more details.`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sv__cta-btn sv__cta-btn--whatsapp"
                >
                  <MessageCircle size={16} /> WhatsApp
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="sv__footer">
        Powered by <a href="https://rabsconnect.in" target="_blank" rel="noopener noreferrer">RABS Connect CRM</a>
      </footer>

      {/* Lightbox */}
      {lightboxImg && (
        <div className="sv__lightbox" onClick={() => setLightboxImg(null)}>
          <button className="sv__lightbox-close" onClick={() => setLightboxImg(null)}>
            <X size={18} />
          </button>
          <img src={lightboxImg} alt="Preview" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
};

function renderInfo(label, value, fullWidth) {
  if (!value && value !== 0) return null;
  return (
    <div className="sv__info-item" style={fullWidth ? { gridColumn: '1 / -1' } : undefined}>
      <span className="sv__info-label">{label}</span>
      <span className="sv__info-value">{value}</span>
    </div>
  );
}

function renderAmenities(amenitiesStr) {
  if (!amenitiesStr) return null;
  const list = amenitiesStr.split(',').map(a => a.trim()).filter(Boolean);
  if (list.length === 0) return null;
  return (
    <div className="sv__section">
      <h3 className="sv__section-title">Amenities</h3>
      <div className="sv__amenities">
        {list.map((a, i) => (
          <span key={i} className="sv__amenity-chip">{a}</span>
        ))}
      </div>
    </div>
  );
}

export default SharedView;
