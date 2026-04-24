import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiFetch } from '../../utils/api';
import Header from '../../components/layout/Header';
import { Button, Modal } from '../../components/common/Common';
import { ArrowLeft, Edit2, Trash2, MapPin, Bed, Bath, Maximize, Building2, Share2, Copy, Link, Eye, XCircle } from 'lucide-react';

const STATUS_MAP = {
  available: { label: 'Available', color: '#22c55e', bg: '#f0fdf4' },
  sold:      { label: 'Sold',      color: '#ef4444', bg: '#fef2f2' },
  rented:    { label: 'Rented',    color: '#3b82f6', bg: '#eff6ff' },
  reserved:  { label: 'Reserved',  color: '#f59e0b', bg: '#fffbeb' },
};

const ViewProperty = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDelete, setShowDelete] = useState(false);
  const [toast, setToast] = useState(null);

  // Share state
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareData, setShareData] = useState(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch(`properties/${id}`);
        if (res.success) setProperty(res.data);
      } catch (err) {
        console.error('Fetch property error:', err);
      }
      setLoading(false);
    })();
  }, [id]);

  const handleDelete = async () => {
    try {
      const res = await apiFetch(`properties/${id}`, { method: 'DELETE' });
      if (res.success) navigate('/properties/all');
    } catch (err) {}
    setShowDelete(false);
  };

  // ── Share handlers ──
  const handleShare = async () => {
    setShareLoading(true);
    setShowShareModal(true);
    setCopied(false);
    try {
      const res = await apiFetch('share', {
        method: 'POST',
        body: JSON.stringify({ entity_type: 'property', entity_id: parseInt(id) }),
      });
      if (res.success && res.data) {
        setShareData(res.data);
      } else {
        setShowShareModal(false);
      }
    } catch (err) {
      setShowShareModal(false);
    }
    setShareLoading(false);
  };

  const copyShareLink = () => {
    if (shareData?.share_url) {
      navigator.clipboard.writeText(shareData.share_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const deactivateShareLink = async () => {
    if (!shareData?.link_id) return;
    try {
      const res = await apiFetch(`share/${shareData.link_id}`, { method: 'DELETE' });
      if (res.success) {
        setShareData(null);
        setShowShareModal(false);
      }
    } catch (err) {}
  };

  const formatPrice = (price) => {
    if (!price) return '-';
    const n = Number(price);
    if (n >= 10000000) return '₹' + (n / 10000000).toFixed(2) + ' Cr';
    if (n >= 100000) return '₹' + (n / 100000).toFixed(2) + ' L';
    return '₹' + n.toLocaleString('en-IN');
  };

  if (loading) return <div className="page" style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Loading...</div>;
  if (!property) return <div className="page" style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Property not found</div>;

  const st = STATUS_MAP[property.status] || STATUS_MAP.available;
  const amenities = property.amenities ? property.amenities.split(',').map(a => a.trim()).filter(Boolean) : [];

  return (
    <div>
      <Header
        title={property.title}
        subtitle={property.location || 'Property Details'}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="outline" icon={ArrowLeft} onClick={() => navigate('/properties/all')}>Back</Button>
            <Button variant="outline" icon={Share2} onClick={handleShare}>Share</Button>
            <Button variant="outline" icon={Edit2} onClick={() => navigate(`/properties/edit/${id}`)}>Edit</Button>
            <Button variant="danger" icon={Trash2} onClick={() => setShowDelete(true)}>Delete</Button>
          </div>
        }
      />
      <div className="page">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>
          {/* Main Content */}
          <div>
            {/* Details Grid */}
            <div className="ab-section">
              <h3 className="ab-section__title">Property Details</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                {[
                  { label: 'Type', value: property.property_type || '-' },
                  { label: 'Configuration', value: property.configuration || '-' },
                  { label: 'Bedrooms', value: property.bedrooms ?? '-', icon: Bed },
                  { label: 'Bathrooms', value: property.bathrooms ?? '-', icon: Bath },
                  { label: 'Area', value: property.area ? `${property.area} ${property.area_unit || 'sqft'}` : '-', icon: Maximize },
                  { label: 'Floor', value: property.floor ? `${property.floor}${property.total_floors ? ' / ' + property.total_floors : ''}` : '-' },
                  { label: 'Furnishing', value: property.furnishing || '-' },
                  { label: 'Facing', value: property.facing || '-' },
                  { label: 'Project', value: property.project_name || '-', icon: Building2 },
                ].map((d, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: 0.3 }}>{d.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--gray-700)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {d.icon && React.createElement(d.icon, { size: 13 })}
                      {d.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Location */}
            {(property.location || property.address) && (
              <div className="ab-section">
                <h3 className="ab-section__title">Location</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {property.location && <p style={{ fontSize: 13, color: 'var(--gray-700)', display: 'flex', alignItems: 'center', gap: 4, margin: 0 }}><MapPin size={14} /> {property.location}</p>}
                  {property.address && <p style={{ fontSize: 12, color: 'var(--gray-500)', margin: 0 }}>{property.address}</p>}
                </div>
              </div>
            )}

            {/* Description */}
            {property.description && (
              <div className="ab-section">
                <h3 className="ab-section__title">Description</h3>
                <p style={{ fontSize: 13, color: 'var(--gray-600)', lineHeight: 1.7, margin: 0 }}>{property.description}</p>
              </div>
            )}
          </div>

          {/* Right Sidebar */}
          <div>
            {/* Price Card */}
            <div className="ab-section" style={{ textAlign: 'center' }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--gray-900)' }}>{formatPrice(property.price)}</span>
              <div style={{ marginTop: 8 }}>
                <span style={{ display: 'inline-flex', padding: '4px 14px', borderRadius: 12, fontSize: 12, fontWeight: 600, color: st.color, background: st.bg }}>
                  {st.label}
                </span>
              </div>
              {property.created_at && (
                <p style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 12 }}>
                  Listed on {new Date(property.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              )}
            </div>

            {/* Amenities */}
            {amenities.length > 0 && (
              <div className="ab-section">
                <h3 className="ab-section__title">Amenities</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {amenities.map((a, i) => (
                    <span key={i} style={{ padding: '4px 10px', borderRadius: 8, background: 'var(--gray-50)', border: '1px solid var(--gray-200)', fontSize: 11, fontWeight: 500, color: 'var(--gray-600)' }}>
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal isOpen={showDelete} onClose={() => setShowDelete(false)} title="Delete Property" size="sm">
        <p style={{ color: 'var(--gray-600)', marginBottom: 20 }}>Are you sure?</p>
        <div className="modal__actions">
          <Button variant="outline" onClick={() => setShowDelete(false)}>Cancel</Button>
          <Button variant="danger" icon={Trash2} onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>

      {/* Share Modal */}
      <Modal isOpen={showShareModal} onClose={() => setShowShareModal(false)} title="Share Property" size="sm">
        {shareLoading ? (
          <div style={{ textAlign: 'center', padding: 30, color: 'var(--gray-400)' }}>
            Generating share link...
          </div>
        ) : shareData ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Link size={16} style={{ color: 'var(--gray-400)', flexShrink: 0 }} />
              <input
                readOnly
                value={shareData.share_url}
                style={{
                  flex: 1, padding: '10px 12px', borderRadius: 8,
                  border: '1px solid var(--gray-200)', fontSize: 13,
                  background: 'var(--gray-50)', color: 'var(--gray-700)',
                  outline: 'none',
                }}
                onClick={e => e.target.select()}
              />
              <Button variant={copied ? 'primary' : 'outline'} icon={Copy} onClick={copyShareLink} style={{ flexShrink: 0 }}>
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--gray-50)', borderRadius: 8, border: '1px solid var(--gray-200)' }}>
              <Eye size={16} style={{ color: 'var(--gray-400)' }} />
              <span style={{ fontSize: 13, color: 'var(--gray-600)' }}>
                <strong style={{ color: 'var(--gray-800)' }}>{shareData.view_count || 0}</strong> views
              </span>
              <span style={{ fontSize: 11, color: 'var(--gray-400)', marginLeft: 'auto' }}>
                Created {new Date(shareData.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            </div>
            <button
              onClick={deactivateShareLink}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '8px 0', background: 'none', border: 'none',
                color: '#ef4444', fontSize: 12, fontWeight: 500,
                cursor: 'pointer', opacity: 0.8,
              }}
            >
              <XCircle size={14} /> Deactivate Link
            </button>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};

export default ViewProperty;
