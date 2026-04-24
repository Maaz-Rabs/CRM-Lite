import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { apiFetch } from '../utils/api';

const CRMContext = createContext();

export const useCRM = () => {
  const context = useContext(CRMContext);
  if (!context) throw new Error('useCRM must be used within CRMProvider');
  return context;
};

export const CRMProvider = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [masterData, setMasterData] = useState(null);
  const [masterLoading, setMasterLoading] = useState(true);
  const [categoryCounts, setCategoryCounts] = useState({});

  // ─── Fetch master data on mount ────────────────────────
  useEffect(() => {
    fetchMasterData();
    fetchCategoryCounts();
  }, []);

  const fetchMasterData = async () => {
    try {
      setMasterLoading(true);
      const res = await apiFetch('leads/master-data');
      if (res.success) setMasterData(res.data);
    } catch (err) {
      console.error('Failed to fetch master data:', err);
    } finally {
      setMasterLoading(false);
    }
  };

  const fetchCategoryCounts = async () => {
    try {
      const res = await apiFetch('leads/category-counts');
      if (res.success) setCategoryCounts(res.data);
    } catch (err) {
      console.error('Failed to fetch category counts:', err);
    }
  };

  // ─── Leads API calls ──────────────────────────────────
  const fetchLeads = useCallback(async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      if (filters.page) params.append('page', filters.page);
      if (filters.limit) params.append('limit', filters.limit);
      if (filters.search) params.append('search', filters.search);
      if (filters.status) params.append('status', filters.status);
      if (filters.statuses) params.append('statuses', filters.statuses);
      if (filters.priority) params.append('priority', filters.priority);
      if (filters.source) params.append('source', filters.source);
      if (filters.sources) params.append('sources', filters.sources);
      if (filters.assign_status) params.append('assign_status', filters.assign_status);
      if (filters.assigned_to) params.append('assigned_to', filters.assigned_to);
      if (filters.is_fresh !== undefined) params.append('is_fresh', filters.is_fresh);
      if (filters.is_imported !== undefined) params.append('is_imported', filters.is_imported);
      if (filters.exclude_imported !== undefined) params.append('exclude_imported', filters.exclude_imported);
      if (filters.no_status !== undefined) params.append('no_status', filters.no_status);
      if (filters.has_followup !== undefined) params.append('has_followup', filters.has_followup);
      if (filters.created_from) params.append('created_from', filters.created_from);
      if (filters.created_to) params.append('created_to', filters.created_to);
      if (filters.property_types) params.append('property_types', filters.property_types);
      if (filters.projects) params.append('projects', filters.projects);
      if (filters.form_name) params.append('form_name', filters.form_name);
      if (filters.followup_filter) params.append('followup_filter', filters.followup_filter);
      if (filters.followup_from) params.append('followup_from', filters.followup_from);
      if (filters.followup_to) params.append('followup_to', filters.followup_to);
      const qs = params.toString();
      const res = await apiFetch(`leads${qs ? '?' + qs : ''}`);
      return res;
    } catch (err) {
      console.error('Fetch leads error:', err);
      return { success: false, data: { leads: [], pagination: {} } };
    }
  }, []);

  const fetchLead = useCallback(async (id) => {
    try {
      const res = await apiFetch(`leads/${id}`);
      return res;
    } catch (err) {
      console.error('Fetch lead error:', err);
      return { success: false };
    }
  }, []);

  const createLead = useCallback(async (payload) => {
    try {
      const res = await apiFetch('leads', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (res.success) fetchCategoryCounts();
      return res;
    } catch (err) {
      console.error('Create lead error:', err);
      return { success: false, message: 'Failed to create lead' };
    }
  }, []);

  const updateLead = useCallback(async (id, payload) => {
    try {
      const res = await apiFetch(`leads/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      return res;
    } catch (err) {
      console.error('Update lead error:', err);
      return { success: false, message: 'Failed to update lead' };
    }
  }, []);

  const deleteLead = useCallback(async (id) => {
    try {
      const res = await apiFetch(`leads/${id}`, { method: 'DELETE' });
      if (res.success) fetchCategoryCounts();
      return res;
    } catch (err) {
      console.error('Delete lead error:', err);
      return { success: false, message: 'Failed to delete lead' };
    }
  }, []);

  const updateLeadStatus = useCallback(async (id, statusId) => {
    try {
      const res = await apiFetch(`leads/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ ls_id: statusId }),
      });
      return res;
    } catch (err) {
      return { success: false };
    }
  }, []);

  const updateLeadPriority = useCallback(async (id, priorityId) => {
    try {
      const res = await apiFetch(`leads/${id}/priority`, {
        method: 'PATCH',
        body: JSON.stringify({ lp_id: priorityId }),
      });
      return res;
    } catch (err) {
      return { success: false };
    }
  }, []);

  const assignLead = useCallback(async (id, userIds) => {
    try {
      const res = await apiFetch(`leads/${id}/assign`, {
        method: 'POST',
        body: JSON.stringify({ user_ids: userIds }),
      });
      if (res.success) fetchCategoryCounts();
      return res;
    } catch (err) {
      return { success: false };
    }
  }, []);

  const unassignLead = useCallback(async (id) => {
    try {
      const res = await apiFetch(`leads/${id}/unassign`, { method: 'POST' });
      if (res.success) fetchCategoryCounts();
      return res;
    } catch (err) {
      return { success: false };
    }
  }, []);

  const addComment = useCallback(async (id, comment) => {
    try {
      const res = await apiFetch(`leads/${id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ comment }),
      });
      return res;
    } catch (err) {
      return { success: false };
    }
  }, []);

  const addFollowup = useCallback(async (id, followupData) => {
    try {
      const res = await apiFetch(`leads/${id}/followup`, {
        method: 'POST',
        body: JSON.stringify(followupData),
      });
      return res;
    } catch (err) {
      return { success: false };
    }
  }, []);

  const lockLead = useCallback(async (id) => {
    try {
      const res = await apiFetch(`leads/${id}/lock`, { method: 'PATCH' });
      return res;
    } catch (err) {
      return { success: false };
    }
  }, []);

  const transferLeads = useCallback(async (leadIds, userIds, statusId) => {
    try {
      for (const id of leadIds) {
        await apiFetch(`leads/${id}/assign`, {
          method: 'POST',
          body: JSON.stringify({ user_ids: userIds, ...(statusId ? { status_id: statusId } : {}) }),
        });
      }
      fetchCategoryCounts();
      return { success: true };
    } catch (err) {
      return { success: false };
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await apiFetch('leads/users');
      return res;
    } catch (err) {
      return { success: false, data: [] };
    }
  }, []);

  // ─── Loans API calls ──────────────────────────────────
  const fetchLoans = useCallback(async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      if (filters.page) params.append('page', filters.page);
      if (filters.limit) params.append('limit', filters.limit);
      if (filters.search) params.append('search', filters.search);
      if (filters.status) params.append('status', filters.status);
      if (filters.loan_type) params.append('loan_type', filters.loan_type);
      const qs = params.toString();
      const res = await apiFetch(`loans${qs ? '?' + qs : ''}`);
      return res;
    } catch (err) {
      console.error('Fetch loans error:', err);
      return { success: false, data: [] };
    }
  }, []);

  const fetchLoanStats = useCallback(async () => {
    try {
      const res = await apiFetch('loans/stats');
      return res;
    } catch (err) {
      return { success: false, data: {} };
    }
  }, []);

  const createLoanRecord = useCallback(async (payload) => {
    try {
      const res = await apiFetch('loans', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return res;
    } catch (err) {
      console.error('Create loan error:', err);
      return { success: false, message: 'Failed to create loan' };
    }
  }, []);

  const updateLoanRecord = useCallback(async (loanId, payload) => {
    try {
      const res = await apiFetch(`loans/${loanId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      return res;
    } catch (err) {
      console.error('Update loan error:', err);
      return { success: false, message: 'Failed to update loan' };
    }
  }, []);

  const deleteLoanRecord = useCallback(async (loanId) => {
    try {
      const res = await apiFetch(`loans/${loanId}`, {
        method: 'DELETE',
      });
      return res;
    } catch (err) {
      console.error('Delete loan error:', err);
      return { success: false, message: 'Failed to delete loan' };
    }
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen(prev => !prev);
  }, []);

  const value = {
    sidebarOpen, setSidebarOpen, toggleSidebar,
    masterData, masterLoading, categoryCounts,
    fetchMasterData, fetchCategoryCounts,
    fetchLeads, fetchLead, createLead, updateLead, deleteLead,
    updateLeadStatus, updateLeadPriority,
    assignLead, unassignLead, addComment, addFollowup,
    lockLead, transferLeads, fetchUsers,
    fetchLoans, fetchLoanStats, createLoanRecord, updateLoanRecord, deleteLoanRecord,
  };

  return <CRMContext.Provider value={value}>{children}</CRMContext.Provider>;
};
