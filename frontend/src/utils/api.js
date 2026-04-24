// ─── API Utility for Website ─────────────────────────────
const VERIFY_API_URL = 'https://backendcrm.rabs.in.net/mobile_view_api_url/pull_url.php';

// Get stored data from localStorage
const getStoredData = (key) => {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : null;
  } catch { return null; }
};

const setStoredData = (key, val) => {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { }
};

const removeStoredData = (key) => {
  try { localStorage.removeItem(key); } catch { }
};

// Storage keys
export const STORAGE_KEYS = {
  CLIENT_DATA: 'rabs_client_data',
  USER_DATA: 'rabs_user_data',
  TOKENS: 'rabs_tokens',
  PERMISSIONS: 'rabs_permissions',
  CRM_SETTINGS: 'rabs_crm_settings',
};

// Always ensure trailing slash
const getBase = () => {
  const clientData = getStoredData(STORAGE_KEYS.CLIENT_DATA);
  if (!clientData?.apiBaseUrl) return null;
  return clientData.apiBaseUrl.endsWith('/') ? clientData.apiBaseUrl : clientData.apiBaseUrl + '/';
};

// ─── Build absolute URL for server-hosted files (uploads, etc.) ──
export const getFileUrl = (path) => {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  const clientData = getStoredData(STORAGE_KEYS.CLIENT_DATA);
  if (!clientData?.apiBaseUrl) return path;
  const base = clientData.apiBaseUrl.replace(/\/api\/?$/, '');
  const clean = path.startsWith('/') ? path : '/' + path;
  return base + clean;
};

// ─── Verify client code ──────────────────────────────────
export const verifyClientCode = async (code) => {
  try {
    const response = await fetch(VERIFY_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'select_client_code', client_code: code }),
    });
    const data = await response.json();
    if (!data || data.length === 0) {
      return { success: false, message: 'Invalid client code.' };
    }
    const client = data[0];
    const clientInfo = {
      clientCode: client.cc_id || code,
      companyName: client.client_comp_name || '',
      clientName: client.client_name || '',
      backendUrl: client.nodecrm_backend_url || '',
      frontendUrl: client.nodecrm_frontend_url || '',
      country: client.client_country || '',
      state: client.client_state || '',
      city: client.client_location || '',
      contact: client.client_contact || '',
      email: client.client_email || '',
      logo: client.client_logo1 || '',
      dbName: client.nodecrm_db_name || '',
      apiBaseUrl: 'http://localhost:5000/api/',
      // apiBaseUrl: `https://api.lite.rabsconnect.in/api/`,
    };
    setStoredData(STORAGE_KEYS.CLIENT_DATA, clientInfo);
    return { success: true, data: clientInfo };
  } catch (err) {
    return { success: false, message: 'Connection failed. Please try again.' };
  }
};

// ─── Login ───────────────────────────────────────────────
export const loginApi = async (username, password) => {
  const clientData = getStoredData(STORAGE_KEYS.CLIENT_DATA);
  if (!clientData?.apiBaseUrl) {
    return { success: false, message: 'Please verify client code first.' };
  }
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (clientData.dbName) headers['x-client-db'] = clientData.dbName;

    const response = await fetch(`${getBase()}auth/login`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        username: username.trim(),
        password,
        device_token: '',
        device_platform: 'web',
        device_name: 'Web Browser',
      }),
    });
    const data = await response.json();
    if (!data.success) {
      return { success: false, message: data.message || 'Login failed.' };
    }
    const { user, permissions, tokens, crm } = data.data;
    setStoredData(STORAGE_KEYS.USER_DATA, user);
    setStoredData(STORAGE_KEYS.TOKENS, tokens);
    setStoredData(STORAGE_KEYS.PERMISSIONS, permissions || []);
    setStoredData(STORAGE_KEYS.CRM_SETTINGS, crm || null);
    return { success: true, data: { user, permissions, tokens, crm } };
  } catch (err) {
    return { success: false, message: 'Connection failed.' };
  }
};

// ─── API Fetch (authenticated) ───────────────────────────
export const apiFetch = async (endpoint, options = {}) => {
  const clientData = getStoredData(STORAGE_KEYS.CLIENT_DATA);
  const tokens = getStoredData(STORAGE_KEYS.TOKENS);
  if (!clientData?.apiBaseUrl) throw new Error('API URL not configured');

  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  const url = `${getBase()}${cleanEndpoint}`;

  const isFormData = options.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers || {}),
  };

  if (tokens?.access_token) {
    headers['Authorization'] = `Bearer ${tokens.access_token}`;
  }
  if (clientData.dbName) {
    headers['x-client-db'] = clientData.dbName;
  }

  const response = await fetch(url, { ...options, headers });
  const data = await response.json();

  // If 401, try refresh
  if (response.status === 401 && tokens?.refresh_token && !options._isRetry) {
    const refreshed = await refreshTokens();
    if (refreshed) {
      return apiFetch(endpoint, { ...options, _isRetry: true });
    } else {
      // Clear all and redirect to login
      Object.values(STORAGE_KEYS).forEach(k => removeStoredData(k));
      window.location.href = '/login';
    }
  }

  return { status: response.status, ...data };
};

// ─── Refresh Tokens ──────────────────────────────────────
const refreshTokens = async () => {
  try {
    const clientData = getStoredData(STORAGE_KEYS.CLIENT_DATA);
    const tokens = getStoredData(STORAGE_KEYS.TOKENS);
    if (!tokens?.refresh_token || !clientData?.apiBaseUrl) return false;

    const headers = { 'Content-Type': 'application/json' };
    if (clientData.dbName) headers['x-client-db'] = clientData.dbName;

    const response = await fetch(`${getBase()}auth/refresh`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ refresh_token: tokens.refresh_token }),
    });
    const data = await response.json();
    if (data.success && data.data?.tokens) {
      setStoredData(STORAGE_KEYS.TOKENS, data.data.tokens);
      return true;
    }
    return false;
  } catch {
    return false;
  }
};

// ─── Logout ──────────────────────────────────────────────
export const logoutApi = () => {
  Object.values(STORAGE_KEYS).forEach(k => removeStoredData(k));
  removeStoredData('rabs_impersonator_backup');
};

// ─── Helpers ─────────────────────────────────────────────
export const getStoredUser = () => getStoredData(STORAGE_KEYS.USER_DATA);
export const getStoredTokens = () => getStoredData(STORAGE_KEYS.TOKENS);
export const getStoredClient = () => getStoredData(STORAGE_KEYS.CLIENT_DATA);
export const getStoredPermissions = () => getStoredData(STORAGE_KEYS.PERMISSIONS);
