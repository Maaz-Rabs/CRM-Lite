import React, { useEffect, useRef, useState } from 'react';
import Header from '../../components/layout/Header';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { apiFetch, getFileUrl, STORAGE_KEYS } from '../../utils/api';
import { Button } from '../../components/common/Common';
import {
  User, Mail, Phone, Briefcase, Building2, Calendar,
  Camera, Loader2, Save, Trash2
} from 'lucide-react';
import './Profile.css';

const Profile = () => {
  const { user: authUser } = useAuth();
  const { showToast } = useToast();
  const fileRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    phone_code: '+91',
    designation: '',
    department: '',
    gender: '',
    date_of_birth: '',
  });
  const [profileImage, setProfileImage] = useState('');
  const [username, setUsername] = useState('');
  const [roleName, setRoleName] = useState('');

  const loadProfile = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('auth/me');
      if (res.success) {
        const u = res.data?.user || res.data || {};
        setForm({
          first_name: u.first_name || '',
          last_name: u.last_name || '',
          email: u.email || '',
          phone: u.phone || '',
          phone_code: u.phone_code || '+91',
          designation: u.designation || '',
          department: u.department || '',
          gender: u.gender || '',
          date_of_birth: u.date_of_birth ? String(u.date_of_birth).slice(0, 10) : '',
        });
        setProfileImage(u.profile_image || '');
        setUsername(u.username || '');
        setRoleName(u.role_name || '');
      }
    } catch (err) {
      showToast('Failed to load profile', 'error');
    }
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadProfile(); }, []);

  const handleChange = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const persistLocalUser = (patch) => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.USER_DATA);
      const cur = raw ? JSON.parse(raw) : {};
      localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify({ ...cur, ...patch }));
    } catch { }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiFetch('users/profile', {
        method: 'PUT',
        body: JSON.stringify(form),
      });
      if (res.success) {
        showToast('Profile updated', 'success');
        const updated = res.data?.user || res.data || {};
        persistLocalUser({
          email: updated.email,
          first_name: updated.first_name,
          last_name: updated.last_name,
          full_name: `${updated.first_name || ''} ${updated.last_name || ''}`.trim() || authUser?.username,
          phone: updated.phone,
          phone_code: updated.phone_code,
          designation: updated.designation,
          department: updated.department,
          gender: updated.gender,
          date_of_birth: updated.date_of_birth,
        });
      } else {
        showToast(res.message || 'Failed to update profile', 'error');
      }
    } catch {
      showToast('Connection failed', 'error');
    }
    setSaving(false);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image must be under 5MB', 'error');
      return;
    }
    setUploadingImg(true);
    try {
      const fd = new FormData();
      fd.append('profile_image', file);
      const res = await apiFetch('users/profile/image', { method: 'POST', body: fd });
      if (res.success) {
        const newPath = res.data?.profile_image || res.data?.path || '';
        setProfileImage(newPath);
        persistLocalUser({ profile_image: newPath });
        showToast('Profile photo updated', 'success');
      } else {
        showToast(res.message || 'Upload failed', 'error');
      }
    } catch {
      showToast('Upload failed', 'error');
    }
    setUploadingImg(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleImageDelete = async () => {
    if (!profileImage) return;
    if (!window.confirm('Remove profile photo?')) return;
    setUploadingImg(true);
    try {
      const res = await apiFetch('users/profile/image', { method: 'DELETE' });
      if (res.success) {
        setProfileImage('');
        persistLocalUser({ profile_image: '' });
        showToast('Profile photo removed', 'success');
      } else {
        showToast(res.message || 'Failed to remove photo', 'error');
      }
    } catch {
      showToast('Failed to remove photo', 'error');
    }
    setUploadingImg(false);
  };

  const initial = (form.first_name || username || 'U').trim().charAt(0).toUpperCase();

  return (
    <div>
      <Header title="Profile" subtitle="Update your personal information" />
      <div className="page">
        {loading ? (
          <div className="profile-loading"><Loader2 className="spin" size={20} /> Loading profile…</div>
        ) : (
          <div className="profile-layout">
            {/* Avatar card */}
            <div className="profile-card profile-card--avatar">
              <div className="profile-avatar-lg">
                {profileImage ? (
                  <img src={getFileUrl(profileImage)} alt="Profile" />
                ) : (
                  <span>{initial}</span>
                )}
                <button
                  type="button"
                  className="profile-avatar-edit"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploadingImg}
                  title="Change photo"
                >
                  {uploadingImg ? <Loader2 size={14} className="spin" /> : <Camera size={14} />}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleImageUpload}
                />
              </div>
              <h3 className="profile-name">{[form.first_name, form.last_name].filter(Boolean).join(' ') || username}</h3>
              <span className="profile-role">{roleName}</span>
              {username && <span className="profile-username">@{username}</span>}
              {profileImage && (
                <button
                  type="button"
                  className="profile-remove-photo"
                  onClick={handleImageDelete}
                  disabled={uploadingImg}
                >
                  <Trash2 size={12} /> Remove photo
                </button>
              )}
            </div>

            {/* Form card */}
            <form className="profile-card profile-card--form" onSubmit={handleSave}>
              <h3 className="profile-section-title">Personal Information</h3>

              <div className="profile-grid">
                <div className="profile-field">
                  <label>First Name</label>
                  <div className="profile-input">
                    <User size={14} />
                    <input
                      type="text"
                      value={form.first_name}
                      onChange={e => handleChange('first_name', e.target.value)}
                      placeholder="First name"
                    />
                  </div>
                </div>

                <div className="profile-field">
                  <label>Last Name</label>
                  <div className="profile-input">
                    <User size={14} />
                    <input
                      type="text"
                      value={form.last_name}
                      onChange={e => handleChange('last_name', e.target.value)}
                      placeholder="Last name"
                    />
                  </div>
                </div>

                <div className="profile-field">
                  <label>Email</label>
                  <div className="profile-input">
                    <Mail size={14} />
                    <input
                      type="email"
                      value={form.email}
                      onChange={e => handleChange('email', e.target.value)}
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                <div className="profile-field">
                  <label>Phone</label>
                  <div className="profile-input profile-input--phone">
                    <Phone size={14} />
                    <input
                      type="text"
                      className="profile-phone-code"
                      value={form.phone_code}
                      onChange={e => handleChange('phone_code', e.target.value)}
                      placeholder="+91"
                    />
                    <input
                      type="text"
                      value={form.phone}
                      onChange={e => handleChange('phone', e.target.value)}
                      placeholder="Phone number"
                    />
                  </div>
                </div>

                <div className="profile-field">
                  <label>Designation</label>
                  <div className="profile-input">
                    <Briefcase size={14} />
                    <input
                      type="text"
                      value={form.designation}
                      onChange={e => handleChange('designation', e.target.value)}
                      placeholder="e.g. Sales Executive"
                    />
                  </div>
                </div>

                <div className="profile-field">
                  <label>Department</label>
                  <div className="profile-input">
                    <Building2 size={14} />
                    <input
                      type="text"
                      value={form.department}
                      onChange={e => handleChange('department', e.target.value)}
                      placeholder="e.g. Sales"
                    />
                  </div>
                </div>

                <div className="profile-field">
                  <label>Gender</label>
                  <div className="profile-input">
                    <select
                      value={form.gender}
                      onChange={e => handleChange('gender', e.target.value)}
                    >
                      <option value="">Select</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="profile-field">
                  <label>Date of Birth</label>
                  <div className="profile-input">
                    <Calendar size={14} />
                    <input
                      type="date"
                      value={form.date_of_birth}
                      onChange={e => handleChange('date_of_birth', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="profile-actions">
                <Button variant="gold" type="submit" disabled={saving}>
                  {saving ? <><Loader2 size={14} className="spin" /> Saving…</> : <><Save size={14} /> Save Changes</>}
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;
