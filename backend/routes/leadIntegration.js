const express = require('express');
const router = express.Router();
const response = require('../utils/response');

const EXTERNAL_BASE = 'https://api.leadmanagement.rabsconnect.in/api/v1';

const callExternal = async (method, path, body) => {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${EXTERNAL_BASE}${path}`, opts);
  const text = await r.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  return { ok: r.ok, status: r.status, data };
};

// APP STATUS (maintenance check)
router.post('/app-status', async (req, res) => {
  try {
    const { client_code } = req.body || {};
    if (!client_code) return response.error(res, 'client_code required', 400);
    const r = await callExternal('POST', '/app-status', { client_code });
    return res.status(r.status).json(r.data);
  } catch (err) {
    console.error('[LEAD-INTG] app-status error:', err.message);
    return response.error(res, 'Failed to fetch app status', 500);
  }
});

// CREATE
router.post('/credentials', async (req, res) => {
  try {
    const { client_code, source_name, branch, credentials } = req.body || {};
    if (!client_code || !source_name || !branch || !credentials) {
      return response.error(res, 'client_code, source_name, branch, credentials are required', 400);
    }
    const r = await callExternal('POST', '/client-credentials/create/external', {
      client_code, source_name, branch, credentials,
    });
    return res.status(r.status).json(r.data);
  } catch (err) {
    console.error('[LEAD-INTG] create error:', err.message);
    return response.error(res, 'Failed to create credential', 500);
  }
});

// LIST
router.get('/credentials/:client_code', async (req, res) => {
  try {
    const { client_code } = req.params;
    if (!client_code) return response.error(res, 'client_code required', 400);
    const r = await callExternal('GET', `/client-credentials/list/external/${encodeURIComponent(client_code)}`);
    return res.status(r.status).json(r.data);
  } catch (err) {
    console.error('[LEAD-INTG] list error:', err.message);
    return response.error(res, 'Failed to list credentials', 500);
  }
});

// UPDATE
router.put('/credentials', async (req, res) => {
  try {
    const { client_code, source_name, branch, credentials } = req.body || {};
    if (!client_code || !source_name || !branch || !credentials) {
      return response.error(res, 'client_code, source_name, branch, credentials are required', 400);
    }
    const r = await callExternal('POST', '/client-credentials/update/external', {
      client_code, source_name, branch, credentials,
    });
    return res.status(r.status).json(r.data);
  } catch (err) {
    console.error('[LEAD-INTG] update error:', err.message);
    return response.error(res, 'Failed to update credential', 500);
  }
});

// DELETE
router.delete('/credentials', async (req, res) => {
  try {
    const { client_code, source_name, branch } = req.body || {};
    if (!client_code || !source_name || !branch) {
      return response.error(res, 'client_code, source_name, branch are required', 400);
    }
    const r = await callExternal('DELETE', '/client-credentials/delete/external', {
      client_code, source_name, branch,
    });
    return res.status(r.status).json(r.data);
  } catch (err) {
    console.error('[LEAD-INTG] delete error:', err.message);
    return response.error(res, 'Failed to delete credential', 500);
  }
});

module.exports = router;
