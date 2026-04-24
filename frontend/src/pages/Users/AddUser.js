import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiFetch } from '../../utils/api';
import Header from '../../components/layout/Header';
import { Button } from '../../components/common/Common';
import { Save, ArrowLeft, Eye, EyeOff, ChevronDown, ChevronRight, Check } from 'lucide-react';
import './Users.css';

const ADMIN_ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'branch_admin', label: 'Branch Admin' },
];
const EMPLOYEE_ROLES = [
  { value: 'team_leader', label: 'Team Leader' },
  { value: 'sales_manager', label: 'Sales Manager' },
  { value: 'tele_caller', label: 'Tele Caller' },
];
const HR_ROLES = [
  { value: 'hr_head', label: 'HR Head' },
  { value: 'hr', label: 'HR' },
];

const MODULE_ACCESS = {
  leads: {
    label: 'Leads',
    permissions: [
      { key: 'leads.view', label: 'View Leads' },
      { key: 'leads.add', label: 'Add Leads' },
      { key: 'leads.edit', label: 'Edit Leads' },
      { key: 'leads.delete', label: 'Delete Leads' },
      { key: 'leads.call', label: 'Call' },
      { key: 'leads.whatsapp', label: 'WhatsApp' },
      { key: 'leads.email', label: 'Email' },
      { key: 'leads.assign', label: 'Assign Leads' },
      { key: 'leads.import', label: 'Import Leads' },
      { key: 'leads.export', label: 'Export Leads' },
    ],
  },
  followup: {
    label: 'Follow-ups',
    permissions: [
      { key: 'followup.view', label: 'View Follow-ups' },
    ],
  },
  status: {
    label: 'Status',
    permissions: [
      { key: 'status.view', label: 'View Status' },
    ],
  },
  brokers: {
    label: 'Broker Module',
    permissions: [
      { key: 'brokers.view', label: 'View Brokers' },
      { key: 'brokers.add', label: 'Add Brokers' },
      { key: 'brokers.edit', label: 'Edit Brokers' },
      { key: 'brokers.delete', label: 'Delete Brokers' },
    ],
  },
  users: {
    label: 'Team Management',
    permissions: [
      { key: 'users.view', label: 'View Users' },
      { key: 'users.add', label: 'Add Users' },
      { key: 'users.edit', label: 'Edit Users' },
    ],
  },
};

const AddUser = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [usernameEdited, setUsernameEdited] = useState(false);
  const [expandedModules, setExpandedModules] = useState({});

  const [form, setForm] = useState({
    name: '', username: '', password: '', mobile: '', email: '',
    user_type: 'employee', role: 'tele_caller',
    team_leader_id: '', sales_manager_id: '',
  });
  const [permissions, setPermissions] = useState({});

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch('users');
        if (res.success) setAllUsers(res.data?.users || []);
      } catch (err) {}
    })();
  }, []);

  useEffect(() => {
    if (isEditing) {
      (async () => {
        try {
          const res = await apiFetch(`users/${id}`);
          if (res.success && res.data?.user) {
            const u = res.data.user;
            setForm({
              name: u.username || '', username: u.username || '', password: '',
              mobile: '', email: u.email || '',
              user_type: 'employee', role: u.role_slug || 'tele_caller',
              team_leader_id: u.reports_to || '', sales_manager_id: '',
            });
            setUsernameEdited(true);
          }
          // Fetch permissions
          const permRes = await apiFetch(`users/${id}/permissions`);
          if (permRes.success) {
            setPermissions(permRes.data?.permissions || {});
          }
        } catch (err) {}
      })();
    }
  }, [id, isEditing]);

  const generateUsername = (fullName) => {
    if (!fullName) return '';
    return fullName.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '.');
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(p => ({ ...p, [name]: value }));
    if (errors[name]) setErrors(p => ({ ...p, [name]: '' }));

    if (name === 'name' && !usernameEdited) {
      setForm(p => ({ ...p, name: value, username: generateUsername(value) }));
    }
    if (name === 'username') setUsernameEdited(true);
    if (name === 'user_type') {
      const defaultRole = value === 'admin' ? 'admin' : 'tele_caller';
      setForm(p => ({ ...p, user_type: value, role: defaultRole }));
    }
  };

  const showToast = (msg, type = 'success') => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const togglePermission = (key) => setPermissions(p => ({ ...p, [key]: !p[key] }));
  const toggleModule = (key) => setExpandedModules(p => ({ ...p, [key]: !p[key] }));

  const selectAllModule = (moduleKey, select) => {
    const mod = MODULE_ACCESS[moduleKey];
    const next = { ...permissions };
    mod.permissions.forEach(p => { next[p.key] = select; });
    setPermissions(next);
  };

  const selectAllPermissions = (select) => {
    const next = {};
    Object.values(MODULE_ACCESS).forEach(mod => {
      mod.permissions.forEach(p => { next[p.key] = select; });
    });
    setPermissions(next);
  };

  const validateStep1 = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.username.trim()) e.username = 'Username is required';
    if (!isEditing && !form.password) e.password = 'Password is required';
    if (form.password && form.password.length < 4) e.password = 'Min 4 characters';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) setStep(2);
    else if (step === 2) setStep(3);
  };

  const handleBack = () => { if (step > 1) setStep(step - 1); };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        username: form.username.trim(),
        email: form.email || null,
        mobile: form.mobile || null,
        user_type: form.user_type,
        role: form.role,
        team_leader_id: form.team_leader_id || null,
        sales_manager_id: form.sales_manager_id || null,
        permissions,
      };
      if (form.password) payload.password = form.password;

      const endpoint = isEditing ? `users/${id}` : 'users';
      const method = isEditing ? 'PUT' : 'POST';
      const res = await apiFetch(endpoint, { method, body: JSON.stringify(payload) });

      if (res.success) {
        showToast(isEditing ? 'User updated!' : 'User created!');
        setTimeout(() => navigate('/users/all'), 1200);
      } else {
        showToast(res.message || 'Failed to save', 'error');
      }
    } catch (err) {
      showToast('Failed to save', 'error');
    }
    setSaving(false);
  };

  const getRoles = () => {
    if (form.user_type === 'admin') return ADMIN_ROLES;
    return EMPLOYEE_ROLES;
  };

  const teamLeaders = allUsers.filter(u => u.role_slug === 'team_leader');
  const salesManagers = allUsers.filter(u => u.role_slug === 'sales_manager');

  const needsTL = form.user_type === 'employee' && (form.role === 'sales_manager' || form.role === 'tele_caller') && teamLeaders.length > 0;
  const needsSM = form.user_type === 'employee' && form.role === 'tele_caller' && salesManagers.length > 0;

  const totalPerms = Object.values(MODULE_ACCESS).reduce((s, m) => s + m.permissions.length, 0);
  const activePerms = Object.values(permissions).filter(Boolean).length;

  return (
    <div>
      <Header
        title={isEditing ? 'Edit User' : 'Add User'}
        subtitle={isEditing ? 'Update user details' : 'Create a new team member'}
        actions={<Button variant="outline" icon={ArrowLeft} onClick={() => navigate('/users/all')}>Back</Button>}
      />
      <div className="page">
        {/* Stepper */}
        <div className="usr-stepper">
          {[{ n: 1, label: 'Basic Info' }, { n: 2, label: 'Role & Reporting' }, { n: 3, label: 'Permissions' }].map((s, i) => (
            <React.Fragment key={s.n}>
              <div className={`usr-stepper__step ${step === s.n ? 'usr-stepper__step--active' : ''} ${step > s.n ? 'usr-stepper__step--done' : ''}`} onClick={() => { if (s.n < step || (s.n === 2 && validateStep1())) setStep(s.n); }}>
                <span className="usr-stepper__num">{step > s.n ? '✓' : s.n}</span>
                <span className="usr-stepper__label">{s.label}</span>
              </div>
              {i < 2 && <div className={`usr-stepper__line ${step > s.n ? 'usr-stepper__line--done' : ''}`} />}
            </React.Fragment>
          ))}
        </div>

        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div className="usr-section">
            <h3 className="usr-section__title">Basic Information</h3>
            <div className="usr-section__grid">
              <div className="usr-field">
                <label className="usr-field__label">Full Name <span className="usr-field__req">*</span></label>
                <input className={`usr-field__input ${errors.name ? 'usr-field__input--error' : ''}`} name="name" value={form.name} onChange={handleChange} placeholder="e.g. John Doe" />
                {errors.name && <span className="usr-field__error">{errors.name}</span>}
              </div>
              <div className="usr-field">
                <label className="usr-field__label">Username <span className="usr-field__req">*</span></label>
                <input className={`usr-field__input ${errors.username ? 'usr-field__input--error' : ''}`} name="username" value={form.username} onChange={handleChange} placeholder="Auto-generated from name" disabled={isEditing} />
                {errors.username && <span className="usr-field__error">{errors.username}</span>}
                {!isEditing && <span className="usr-field__hint">Auto-generated from name. You can edit it.</span>}
              </div>
              <div className="usr-field">
                <label className="usr-field__label">Password {!isEditing && <span className="usr-field__req">*</span>}</label>
                <div className="usr-field__password">
                  <input className={`usr-field__input ${errors.password ? 'usr-field__input--error' : ''}`} type={showPassword ? 'text' : 'password'} name="password" value={form.password} onChange={handleChange} placeholder={isEditing ? 'Leave blank to keep current' : 'Min 4 characters'} />
                  <button type="button" className="usr-field__eye" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password && <span className="usr-field__error">{errors.password}</span>}
              </div>
              <div className="usr-field">
                <label className="usr-field__label">Mobile</label>
                <input className="usr-field__input" name="mobile" value={form.mobile} onChange={handleChange} placeholder="+91 9876543210" />
              </div>
              <div className="usr-field">
                <label className="usr-field__label">Email</label>
                <input className={`usr-field__input ${errors.email ? 'usr-field__input--error' : ''}`} type="email" name="email" value={form.email} onChange={handleChange} placeholder="email@example.com" />
                {errors.email && <span className="usr-field__error">{errors.email}</span>}
              </div>
            </div>
            <div className="usr-form__actions" style={{ marginTop: 20 }}>
              <Button variant="gold" onClick={handleNext}>Next: Role & Reporting</Button>
            </div>
          </div>
        )}

        {/* Step 2: Role & Reporting */}
        {step === 2 && (
          <div className="usr-section">
            <h3 className="usr-section__title">Role & Reporting</h3>

            {/* User Type */}
            <div className="usr-field" style={{ marginBottom: 20 }}>
              <label className="usr-field__label">User Type</label>
              <div className="usr-type-tabs">
                {[{ v: 'admin', l: 'Admin' }, { v: 'employee', l: 'Employee' }].map(t => (
                  <button key={t.v} type="button" className={`usr-type-tab ${form.user_type === t.v ? 'usr-type-tab--active' : ''}`} onClick={() => handleChange({ target: { name: 'user_type', value: t.v } })}>{t.l}</button>
                ))}
              </div>
            </div>

            <div className="usr-section__grid">
              {/* Role */}
              <div className="usr-field">
                <label className="usr-field__label">Role <span className="usr-field__req">*</span></label>
                <select className="usr-field__input usr-field__select" name="role" value={form.role} onChange={handleChange}>
                  {getRoles().map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>

              {/* Team Leader */}
              {needsTL && (
                <div className="usr-field">
                  <label className="usr-field__label">Team Leader</label>
                  <select className="usr-field__input usr-field__select" name="team_leader_id" value={form.team_leader_id} onChange={handleChange}>
                    <option value="">— Select Team Leader —</option>
                    {teamLeaders.map(u => <option key={u.u_id} value={u.u_id}>{u.username}</option>)}
                  </select>
                </div>
              )}

              {/* Sales Manager */}
              {needsSM && (
                <div className="usr-field">
                  <label className="usr-field__label">Sales Manager</label>
                  <select className="usr-field__input usr-field__select" name="sales_manager_id" value={form.sales_manager_id} onChange={handleChange}>
                    <option value="">— Select Sales Manager —</option>
                    {salesManagers.map(u => <option key={u.u_id} value={u.u_id}>{u.username}</option>)}
                  </select>
                </div>
              )}
            </div>

            <div className="usr-form__actions" style={{ marginTop: 20 }}>
              <Button variant="outline" onClick={handleBack}>Back</Button>
              <Button variant="gold" onClick={handleNext}>Next: Permissions</Button>
            </div>
          </div>
        )}

        {/* Step 3: Permissions */}
        {step === 3 && (
          <div className="usr-section">
            <div className="usr-perm-header">
              <h3 className="usr-section__title" style={{ margin: 0 }}>Module Permissions</h3>
              <div className="usr-perm-header__right">
                <span className="usr-perm-count">{activePerms}/{totalPerms} enabled</span>
                <button type="button" className="usr-perm-toggle-all" onClick={() => selectAllPermissions(activePerms < totalPerms)}>
                  {activePerms < totalPerms ? 'Enable All' : 'Disable All'}
                </button>
              </div>
            </div>

            <div className="usr-perm-modules">
              {Object.entries(MODULE_ACCESS).map(([key, mod]) => {
                const isOpen = expandedModules[key];
                const modActive = mod.permissions.filter(p => permissions[p.key]).length;
                const allOn = modActive === mod.permissions.length;
                return (
                  <div key={key} className="usr-perm-module">
                    <div className="usr-perm-module__header" onClick={() => toggleModule(key)}>
                      <ChevronRight size={16} className={`usr-perm-module__arrow ${isOpen ? 'usr-perm-module__arrow--open' : ''}`} />
                      <span className="usr-perm-module__name">{mod.label}</span>
                      <span className="usr-perm-module__count">{modActive}/{mod.permissions.length}</span>
                      <button type="button" className="usr-perm-module__toggle" onClick={(e) => { e.stopPropagation(); selectAllModule(key, !allOn); }}>
                        {allOn ? 'Disable All' : 'Enable All'}
                      </button>
                    </div>
                    {isOpen && (
                      <div className="usr-perm-module__perms">
                        {mod.permissions.map(p => (
                          <label key={p.key} className="usr-perm-item">
                            <input type="checkbox" checked={!!permissions[p.key]} onChange={() => togglePermission(p.key)} />
                            <span className="usr-perm-item__check">{permissions[p.key] && <Check size={12} />}</span>
                            <span>{p.label}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="usr-form__actions" style={{ marginTop: 20 }}>
              <Button variant="outline" onClick={handleBack}>Back</Button>
              <Button variant="gold" icon={Save} onClick={handleSubmit} disabled={saving}>
                {saving ? 'Saving...' : (isEditing ? 'Update User' : 'Create User')}
              </Button>
            </div>
          </div>
        )}
      </div>

      {toast && <div className={`broker-toast broker-toast--${toast.type}`}>{toast.message}</div>}
    </div>
  );
};

export default AddUser;
