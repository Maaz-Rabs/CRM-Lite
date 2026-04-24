import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import Header from '../../../components/layout/Header';
import AdvancedSearch from '../../../components/leads/AdvancedSearch';
import LeadTable from '../../../components/leads/LeadTable';
import { Button, Modal } from '../../../components/common/Common';
import { apiFetch } from '../../../utils/api';
import useLeads from '../../../hooks/useLeads';
import { Plus, Upload, FileSpreadsheet, Download, X, CheckCircle, AlertCircle, FileText, ChevronLeft, ChevronRight, Eye, Trash2 } from 'lucide-react';

const EXPECTED_COLUMNS = ['name', 'country_code', 'mobile', 'email', 'source', 'buyer_type', 'investment_type', 'country', 'state', 'city', 'locality', 'other_details'];

// Accept common header variations and map them to the canonical column the backend expects.
// Keys are normalized (lowercased, spaces/punctuation → underscores).
const COLUMN_ALIASES = {
  // name
  full_name: 'name',
  fullname: 'name',
  customer_name: 'name',
  contact_name: 'name',
  lead_name: 'name',
  client_name: 'name',
  first_name: 'name',

  // mobile
  phone: 'mobile',
  phone_number: 'mobile',
  phone_no: 'mobile',
  phoneno: 'mobile',
  contact: 'mobile',
  contact_no: 'mobile',
  contact_number: 'mobile',
  mobile_number: 'mobile',
  mobile_no: 'mobile',
  whatsapp: 'mobile',
  whatsapp_number: 'mobile',
  number: 'mobile',
  cell: 'mobile',
  cell_number: 'mobile',

  // email
  email_address: 'email',
  email_id: 'email',
  emailid: 'email',
  e_mail: 'email',

  // country code
  dial_code: 'country_code',
  code: 'country_code',
  phone_code: 'country_code',
  countrycode: 'country_code',

  // misc
  lead_source: 'source',
  type: 'buyer_type',
  notes: 'other_details',
  note: 'other_details',
  remarks: 'other_details',
  remark: 'other_details',
  comments: 'other_details',
  comment: 'other_details',
  details: 'other_details',
};

const REQUIRED_COLUMNS = ['name', 'mobile'];

const normalizeHeader = (raw) =>
  String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, '')   // strip punctuation like - . / ( )
    .replace(/\s+/g, '_');

const canonicalHeader = (raw) => {
  const norm = normalizeHeader(raw);
  return COLUMN_ALIASES[norm] || norm;
};

const ImportLeads = () => {
  const navigate = useNavigate();
  const { leads, loading, pagination, filters, setFilters, onSearch, onPageChange, refresh } = useLeads({ is_imported: true });
  const [showImport, setShowImport] = useState(false);
  const [file, setFile] = useState(null);
  const [previewData, setPreviewData] = useState(null); // { headers, rows }
  const [previewPage, setPreviewPage] = useState(0);
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [step, setStep] = useState(1); // 1=upload, 2=preview, 3=result
  const fileRef = useRef(null);
  const PREVIEW_PER_PAGE = 10;

  const parseFile = useCallback((f) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        if (json.length < 2) {
          setResult({ success: false, message: 'File is empty or has no data rows' });
          return;
        }

        const headers = json[0].map(canonicalHeader);
        const rows = json.slice(1).filter(row => row.some(cell => cell !== ''));

        setPreviewData({ headers, rows });
        setSelectedRows(new Set(rows.map((_, i) => i)));
        setPreviewPage(0);
        setStep(2);
        setResult(null);
      } catch (err) {
        setResult({ success: false, message: 'Failed to parse file. Make sure it\'s a valid CSV/Excel file.' });
      }
    };
    reader.readAsArrayBuffer(f);
  }, []);

  const handleFile = (f) => {
    if (!f) return;
    const ext = f.name.split('.').pop().toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
      setResult({ success: false, message: 'Only CSV, XLSX, XLS files are supported' });
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setResult({ success: false, message: 'File size must be under 5MB' });
      return;
    }
    setFile(f);
    setResult(null);
    parseFile(f);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const toggleRow = (idx) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const toggleAll = () => {
    if (!previewData) return;
    if (selectedRows.size === previewData.rows.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(previewData.rows.map((_, i) => i)));
    }
  };

  const handleUpload = async () => {
    if (!file || !previewData) return;
    setUploading(true);
    setResult(null);
    try {
      // Build selected rows back to array and send as JSON
      const selectedData = previewData.rows
        .filter((_, i) => selectedRows.has(i))
        .map(row => {
          const obj = {};
          previewData.headers.forEach((h, i) => { obj[h] = row[i] || ''; });
          return obj;
        });

      const res = await apiFetch('leads/import', {
        method: 'POST',
        body: JSON.stringify({ leads: selectedData }),
      });

      if (res.success) {
        const d = res.data || {};
        const imported = Number(d.imported || 0);
        const duplicates = Number(d.duplicates || 0);
        const errors = Number(d.errors || 0);
        const total = Number(d.total || selectedData.length);

        if (imported === 0) {
          // API returned OK but nothing actually got saved — treat as failure so user knows.
          const parts = [];
          if (duplicates > 0) parts.push(`${duplicates} duplicate${duplicates !== 1 ? 's' : ''} skipped`);
          if (errors > 0) parts.push(`${errors} row${errors !== 1 ? 's' : ''} had errors (missing name/mobile?)`);
          setResult({
            success: false,
            message: `No leads were imported out of ${total}.${parts.length ? ' ' + parts.join(', ') + '.' : ''}`,
            details: d,
          });
          setStep(3);
        } else {
          const parts = [`${imported} lead${imported !== 1 ? 's' : ''} imported`];
          if (duplicates > 0) parts.push(`${duplicates} duplicate${duplicates !== 1 ? 's' : ''} skipped`);
          if (errors > 0) parts.push(`${errors} error${errors !== 1 ? 's' : ''}`);
          setResult({ success: true, message: parts.join(' · '), details: d });
          setStep(3);
          refresh();
        }
      } else {
        setResult({ success: false, message: res.message || 'Import failed', details: res.data });
      }
    } catch (err) {
      setResult({ success: false, message: 'Failed to import leads' });
    }
    setUploading(false);
  };

  const closeModal = () => {
    setShowImport(false);
    setFile(null);
    setPreviewData(null);
    setSelectedRows(new Set());
    setResult(null);
    setStep(1);
    refresh();
  };

  const goBack = () => {
    setStep(1);
    setFile(null);
    setPreviewData(null);
    setSelectedRows(new Set());
    setResult(null);
  };

  // Preview pagination
  const totalPreviewPages = previewData ? Math.ceil(previewData.rows.length / PREVIEW_PER_PAGE) : 0;
  const pagedRows = previewData ? previewData.rows.slice(previewPage * PREVIEW_PER_PAGE, (previewPage + 1) * PREVIEW_PER_PAGE) : [];
  const pagedStartIdx = previewPage * PREVIEW_PER_PAGE;

  const getColumnStatus = (header) => {
    if (EXPECTED_COLUMNS.includes(header)) return 'matched';
    return 'extra';
  };

  const missingRequired = previewData
    ? REQUIRED_COLUMNS.filter(req => !previewData.headers.includes(req))
    : [];
  const canUpload = previewData && missingRequired.length === 0 && selectedRows.size > 0 && !uploading;

  return (
    <div>
      <Header title="Imported Leads" subtitle={`${pagination.total || 0} imported leads`} actions={
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="outline" icon={Upload} onClick={() => setShowImport(true)}>Import</Button>
          <Button variant="gold" icon={Plus} onClick={() => navigate('/leads/add')}>Add Lead</Button>
        </div>
      } />
      <div className="page">
       <AdvancedSearch filters={filters} setFilters={setFilters} onSearch={onSearch} showLeadType />
        <LeadTable
          leads={leads}
          loading={loading}
          pagination={pagination}
          onPageChange={onPageChange}
          onRefresh={refresh}
          showLeadType={true}
          pageAccentColor="#1d4ed8"
          emptyMessage="No imported leads found"
        />
      </div>

      {/* Import Modal */}
      <Modal isOpen={showImport} onClose={closeModal} title={step === 1 ? 'Import Leads' : step === 2 ? 'Preview & Confirm' : 'Import Complete'} size={step === 2 ? 'lg' : 'md'}>
        <div className="imp">

          {/* Step 1: Upload */}
          {step === 1 && (
            <>
              <div className="imp__steps">
                <div className="imp__step imp__step--active"><span>1</span> Upload File</div>
                <div className="imp__step"><span>2</span> Preview</div>
                <div className="imp__step"><span>3</span> Done</div>
              </div>

              <div className="imp__template">
                <FileSpreadsheet size={18} color="#22c55e" />
                <div className="imp__template-info">
                  <p className="imp__template-title">Download Template</p>
                  <p className="imp__template-sub">Use this format for best results</p>
                </div>
                <button className="imp__template-btn" onClick={() => {
                  const csv = EXPECTED_COLUMNS.join(',') + '\nJohn Doe,+91,9876543210,john@example.com,Direct,End User,Ready to Move,India,Maharashtra,Mumbai,Andheri,Sample lead';
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a'); a.href = url; a.download = 'lead_import_template.csv'; a.click();
                  URL.revokeObjectURL(url);
                }}>
                  <Download size={14} /> Template
                </button>
              </div>

              <div
                className={`imp__drop ${dragOver ? 'imp__drop--drag' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
              >
                <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={(e) => handleFile(e.target.files[0])} hidden />
                <Upload size={32} color="#9ca3af" />
                <p className="imp__drop-title">Drag & drop your file here</p>
                <p className="imp__drop-sub">CSV, XLSX, XLS — max 5MB</p>
              </div>

              {result && !result.success && (
                <div className="imp__alert imp__alert--error">
                  <AlertCircle size={16} /> {result.message}
                </div>
              )}
            </>
          )}

          {/* Step 2: Preview */}
          {step === 2 && previewData && (
            <>
              <div className="imp__steps">
                <div className="imp__step imp__step--done"><span>✓</span> Upload</div>
                <div className="imp__step imp__step--active"><span>2</span> Preview</div>
                <div className="imp__step"><span>3</span> Done</div>
              </div>

              {/* File info bar */}
              <div className="imp__file-bar">
                <div className="imp__file-bar-left">
                  <FileText size={18} color="#4285F4" />
                  <div>
                    <p className="imp__file-name">{file?.name}</p>
                    <p className="imp__file-meta">{previewData.rows.length} rows · {previewData.headers.length} columns · {selectedRows.size} selected</p>
                  </div>
                </div>
                <button className="imp__file-change" onClick={goBack}>Change file</button>
              </div>

              {/* Column mapping info */}
              <div className="imp__col-tags">
                {previewData.headers.map((h, i) => (
                  <span key={i} className={`imp__col-tag imp__col-tag--${getColumnStatus(h)}`}>{h}</span>
                ))}
              </div>

              {missingRequired.length > 0 && (
                <div className="imp__alert imp__alert--error">
                  <AlertCircle size={16} />
                  <span>
                    Missing required column{missingRequired.length > 1 ? 's' : ''}: <strong>{missingRequired.join(', ')}</strong>.
                    Rename your CSV header(s) — the template uses <code>name</code> and <code>mobile</code>. (Aliases like <code>Full Name</code>, <code>Phone</code>, <code>Contact Number</code> are also accepted.)
                  </span>
                </div>
              )}

              {/* Preview Table */}
              <div className="imp__table-wrap">
                <table className="imp__table">
                  <thead>
                    <tr>
                      <th style={{ width: 36 }}>
                        <input type="checkbox" checked={selectedRows.size === previewData.rows.length} onChange={toggleAll} />
                      </th>
                      <th style={{ width: 36 }}>#</th>
                      {previewData.headers.map((h, i) => (
                        <th key={i} className={`imp__th--${getColumnStatus(h)}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pagedRows.map((row, ri) => {
                      const realIdx = pagedStartIdx + ri;
                      const isSelected = selectedRows.has(realIdx);
                      return (
                        <tr key={realIdx} className={isSelected ? '' : 'imp__row--disabled'}>
                          <td><input type="checkbox" checked={isSelected} onChange={() => toggleRow(realIdx)} /></td>
                          <td className="imp__td-num">{realIdx + 1}</td>
                          {previewData.headers.map((_, ci) => (
                            <td key={ci} className="imp__td-cell">{row[ci] || <span className="imp__empty">—</span>}</td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Preview Pagination */}
              {totalPreviewPages > 1 && (
                <div className="imp__paging">
                  <span>Page {previewPage + 1} of {totalPreviewPages}</span>
                  <div className="imp__paging-btns">
                    <button disabled={previewPage <= 0} onClick={() => setPreviewPage(p => p - 1)}><ChevronLeft size={16} /></button>
                    <button disabled={previewPage >= totalPreviewPages - 1} onClick={() => setPreviewPage(p => p + 1)}><ChevronRight size={16} /></button>
                  </div>
                </div>
              )}

              {result && !result.success && (
                <div className="imp__alert imp__alert--error">
                  <AlertCircle size={16} /> {result.message}
                </div>
              )}

              <div className="modal__actions">
                <Button variant="outline" onClick={goBack}>Back</Button>
                <Button variant="gold" icon={Upload} onClick={handleUpload} disabled={!canUpload}>
                  {uploading ? 'Importing...' : `Import ${selectedRows.size} Lead${selectedRows.size !== 1 ? 's' : ''}`}
                </Button>
              </div>
            </>
          )}

          {/* Step 3: Result */}
          {step === 3 && (
            <>
              <div className="imp__steps">
                <div className="imp__step imp__step--done"><span>✓</span> Upload</div>
                <div className="imp__step imp__step--done"><span>✓</span> Preview</div>
                <div className="imp__step imp__step--active"><span>3</span> Done</div>
              </div>

              <div className="imp__result-card">
                {result?.success ? <CheckCircle size={40} color="#22c55e" /> : <AlertCircle size={40} color="#ef4444" />}
                <h3 className="imp__result-title">{result?.success ? 'Import Successful!' : 'Import Failed'}</h3>
                <p className="imp__result-msg">{result?.message}</p>
                {result?.details?.errors > 0 && <p className="imp__result-sub">{result.details.errors} rows had errors</p>}
                {result?.details?.duplicates > 0 && <p className="imp__result-sub">{result.details.duplicates} duplicates skipped</p>}
              </div>

              <div className="modal__actions">
                <Button variant="outline" onClick={closeModal}>Close</Button>
                {result?.success && <Button variant="gold" icon={Eye} onClick={() => { closeModal(); refresh(); }}>View Imported</Button>}
              </div>
            </>
          )}
        </div>
      </Modal>

      <style>{`
        .imp { display: flex; flex-direction: column; gap: 18px; }

        /* Steps */
        .imp__steps { display: flex; gap: 4px; }
        .imp__step { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--gray-400); flex: 1; padding: 10px 12px; background: var(--gray-50); border-radius: 8px; font-weight: 500; }
        .imp__step span { width: 22px; height: 22px; border-radius: 50%; background: var(--gray-200); color: var(--gray-500); font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .imp__step--active { background: var(--navy-50); color: var(--navy-700); }
        .imp__step--active span { background: var(--navy-700); color: white; }
        .imp__step--done { background: #f0fdf4; color: #16a34a; }
        .imp__step--done span { background: #22c55e; color: white; }

        /* Template */
        .imp__template { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; }
        .imp__template-info { flex: 1; }
        .imp__template-title { font-size: 13px; font-weight: 600; color: var(--gray-800); margin: 0; }
        .imp__template-sub { font-size: 11px; color: var(--gray-500); margin: 2px 0 0; }
        .imp__template-btn { display: flex; align-items: center; gap: 5px; padding: 6px 12px; border: 1px solid #86efac; border-radius: 6px; background: white; font-size: 12px; font-weight: 600; color: #16a34a; cursor: pointer; white-space: nowrap; }
        .imp__template-btn:hover { background: #f0fdf4; }

        /* Dropzone */
        .imp__drop { border: 2px dashed var(--gray-300); border-radius: 12px; padding: 36px; text-align: center; cursor: pointer; transition: all 0.2s; display: flex; flex-direction: column; align-items: center; gap: 6px; }
        .imp__drop:hover { border-color: var(--navy-400); background: var(--gray-50); }
        .imp__drop--drag { border-color: #4285F4; background: #eff6ff; }
        .imp__drop-title { font-size: 14px; font-weight: 600; color: var(--gray-600); margin: 0; }
        .imp__drop-sub { font-size: 12px; color: var(--gray-400); margin: 0; }

        /* File bar */
        .imp__file-bar { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: var(--gray-50); border-radius: 10px; border: 1px solid var(--gray-200); }
        .imp__file-bar-left { display: flex; align-items: center; gap: 10px; }
        .imp__file-name { font-size: 13px; font-weight: 600; color: var(--gray-800); margin: 0; }
        .imp__file-meta { font-size: 11px; color: var(--gray-500); margin: 2px 0 0; }
        .imp__file-change { border: none; background: none; color: var(--navy-600); font-size: 12px; font-weight: 600; cursor: pointer; text-decoration: underline; }

        /* Column tags */
        .imp__col-tags { display: flex; gap: 6px; flex-wrap: wrap; }
        .imp__col-tag { padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; }
        .imp__col-tag--matched { background: #dbeafe; color: #1d4ed8; }
        .imp__col-tag--extra { background: var(--gray-100); color: var(--gray-500); }

        /* Preview Table */
        .imp__table-wrap { overflow-x: auto; border: 1px solid var(--gray-200); border-radius: 10px; max-height: 360px; overflow-y: auto; }
        .imp__table { width: 100%; border-collapse: collapse; font-size: 12px; }
        .imp__table thead { position: sticky; top: 0; z-index: 1; }
        .imp__table th { padding: 8px 10px; background: var(--gray-50); border-bottom: 1px solid var(--gray-200); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; color: var(--gray-500); white-space: nowrap; text-align: left; }
        .imp__th--matched { color: #1d4ed8; }
        .imp__th--extra { color: var(--gray-400); }
        .imp__table td { padding: 7px 10px; border-bottom: 1px solid var(--gray-100); white-space: nowrap; max-width: 180px; overflow: hidden; text-overflow: ellipsis; }
        .imp__td-num { color: var(--gray-400); font-weight: 500; }
        .imp__td-cell { color: var(--gray-700); }
        .imp__empty { color: var(--gray-300); }
        .imp__row--disabled { opacity: 0.35; }
        .imp__table input[type="checkbox"] { cursor: pointer; width: 15px; height: 15px; accent-color: var(--navy-700); }

        /* Paging */
        .imp__paging { display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: var(--gray-500); }
        .imp__paging-btns { display: flex; gap: 4px; }
        .imp__paging-btns button { width: 28px; height: 28px; border-radius: 6px; border: 1px solid var(--gray-200); background: var(--white); display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--gray-500); }
        .imp__paging-btns button:disabled { opacity: 0.3; cursor: not-allowed; }

        /* Alert */
        .imp__alert { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 8px; font-size: 12px; font-weight: 500; }
        .imp__alert--error { background: #fef2f2; color: #ef4444; }

        /* Result */
        .imp__result-card { text-align: center; padding: 24px; }
        .imp__result-title { font-size: 18px; font-weight: 700; color: var(--gray-800); margin: 12px 0 6px; }
        .imp__result-msg { font-size: 13px; color: var(--gray-600); margin: 0; }
        .imp__result-sub { font-size: 12px; color: var(--gray-500); margin: 4px 0 0; }
      `}</style>
    </div>
  );
};
export default ImportLeads;
