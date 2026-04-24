import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useCRM } from "../../../context/CRMContext";
import Header from "../../../components/layout/Header";
import {
  Button,
  FormInput,
  FormSelect,
} from "../../../components/common/Common";
import {
  Save,
  RotateCcw,
  Upload,
  X,
  FileText,
  ChevronDown,
} from "lucide-react";
import { apiFetch } from "../../../utils/api";
import "./AddLead.css";

const BUYER_TYPES = ["End User", "Investor", "Dealer", "Builder"];
const INVESTMENT_TYPES = [
  "Ready to Move",
  "Under Construction",
  "Pre Launch",
  "Resale",
];
const POST_HANDOVER = ["Rental", "Resale", "Self Use", "Investment"];
const HANDOVER_YEARS = ["2024", "2025", "2026", "2027", "2028", "2029", "2030"];
const AREA_UNITS = [
  { value: "sqft", label: "Sq Feet" },
  { value: "sqm", label: "Sq Meter" },
  { value: "sqyd", label: "Sq Yard" },
];
const CURRENCIES = [
  { value: "INR", label: "Rupee" },
  { value: "AED", label: "AED" },
  { value: "USD", label: "USD" },
];
const COUNTRY_CODES = [
  { value: "+91", label: "🇮🇳 +91" },
  { value: "+971", label: "🇦🇪 +971" },
  { value: "+974", label: "🇶🇦 +974" },
  { value: "+1", label: "🇺🇸 +1" },
  { value: "+44", label: "🇬🇧 +44" },
];
const COUNTRIES = ["India", "UAE", "Qatar", "USA", "UK"];
const STATES_INDIA = [
  "Maharashtra",
  "Delhi",
  "Karnataka",
  "Tamil Nadu",
  "Gujarat",
  "Rajasthan",
  "Uttar Pradesh",
];
const CITIES_MAHARASHTRA = ["Mumbai", "Pune", "Nagpur", "Thane", "Navi Mumbai"];

const emptyForm = {
  name: "",
  mobile: "",
  email: "",
  alt_mobile: "",
  alt_email: "",
  country_code: "+91",
  alt_country_code: "+91",
  source_type: "direct",
  src_id: "",
  broker_id: "",
  ref_name: "",
  ref_mobile: "",
  ref_email: "",
  ref_country_code: "+91",
  buyer_type: "",
  investment_type: "",
  ls_id: "",
  lp_id: "",
  st_id: "",
  project_ids: [],
  pt_id: "",
  pc_ids: [],
  min_area: "",
  max_area: "",
  area_unit: "sqft",
  min_budget: "",
  max_budget: "",
  budget_currency: "INR",
  country: "",
  state: "",
  city: "",
  locality: "",
  handover_preference: "",
  post_handover: "",
  other_details: "",
};

const AddLead = () => {
  const { createLead, updateLead, fetchLead, masterData } = useCRM();
  const navigate = useNavigate();
  const { id: editId } = useParams();
  const isEdit = !!editId;

  const [formData, setFormData] = useState({ ...emptyForm });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [loadingLead, setLoadingLead] = useState(false);
  const [document, setDocument] = useState(null);
  const fileRef = useRef(null);
  const [openSections, setOpenSections] = useState({
    personal: true,
    requirements: false,
    classification: false,
  });
  const [toast, setToast] = useState(null);
  // useEffect(() => {
  //   const loadLead = async () => {
  //     setLoadingLead(true);
  //     const res = await fetchLead(editId);
  //     setLoadingLead(false);
  //     if (res.success && res.data?.lead) {
  //       const lead = res.data.lead;
  //       setFormData({
  //         name: lead.name || '',
  //         mobile: lead.mobile || '',
  //         email: lead.email || '',
  //         alt_mobile: lead.alt_mobile || '',
  //         alt_email: lead.alt_email || '',
  //         country_code: lead.country_code || '+91',
  //         alt_country_code: lead.alt_country_code || '+91',
  //         source_type: lead.source_type || 'direct',
  //         src_id: lead.src_id || '',
  //         broker_id: lead.broker_id || '',
  //         ref_name: lead.ref_name || '',
  //         ref_mobile: lead.ref_mobile || '',
  //         ref_email: lead.ref_email || '',
  //         ref_country_code: lead.ref_country_code || '+91',
  //         buyer_type: lead.buyer_type || '',
  //         investment_type: lead.investment_type || '',
  //         ls_id: lead.ls_id || '',
  //         lp_id: lead.lp_id || '',
  //         st_id: lead.requirements?.st_id || '',
  //         project_ids: lead.requirements?.project_ids || [],
  //         pt_id: lead.requirements?.pt_id || '',
  //         pc_ids: lead.requirements?.pc_ids || [],
  //         min_area: lead.requirements?.min_area || '',
  //         max_area: lead.requirements?.max_area || '',
  //         area_unit: lead.requirements?.area_unit || 'sqft',
  //         min_budget: lead.requirements?.min_budget || '',
  //         max_budget: lead.requirements?.max_budget || '',
  //         budget_currency: lead.requirements?.budget_currency || 'INR',
  //         country: lead.country || '',
  //         state: lead.state || '',
  //         city: lead.city || '',
  //         locality: lead.locality || '',
  //         handover_preference: lead.requirements?.handover_preference || '',
  //         post_handover: lead.requirements?.post_handover || '',
  //         other_details: lead.requirements?.other_details || '',
  //       });
  //     } else {
  //       setToast({ message: 'Failed to load lead details', type: 'error' });
  //       setTimeout(() => navigate('/leads'), 1500);
  //     }
  //   };

  //   if (isEdit) loadLead();
  // }, [editId, fetchLead, navigate, isEdit]);

  useEffect(() => {
    if (!isEdit) return;
    let cancel = false;
    (async () => {
      setLoadingLead(true);
      const res = await fetchLead(editId);
      if (!cancel && res?.success && res.data?.lead) {
        const l = res.data.lead;
        const req = (l.requirements && l.requirements[0]) || {};
        let projectIds = [];
        let pcIds = [];
        try {
          projectIds =
            typeof req.project_ids === "string"
              ? JSON.parse(req.project_ids)
              : req.project_ids || [];
        } catch {
          projectIds = [];
        }
        try {
          pcIds =
            typeof req.pc_ids === "string"
              ? JSON.parse(req.pc_ids)
              : req.pc_ids || [];
        } catch {
          pcIds = [];
        }

        setFormData({
          name: l.name || "",
          mobile: l.mobile || "",
          email: l.email || "",
          alt_mobile: l.alt_mobile || "",
          alt_email: l.alt_email || "",
          country_code: l.country_code || "+91",
          alt_country_code: l.alt_country_code || "+91",
          source_type: l.source_type || "direct",
          src_id: l.src_id || "",
          broker_id: l.broker_id || "",
          ref_name: l.ref_name || "",
          ref_mobile: l.ref_mobile || "",
          ref_email: l.ref_email || "",
          ref_country_code: l.ref_country_code || "+91",
          buyer_type: l.buyer_type || "",
          investment_type: l.investment_type || "",
          ls_id: l.ls_id || "",
          lp_id: l.lp_id || "",
          st_id: req.st_id || "",
          project_ids: projectIds,
          pt_id: req.pt_id || "",
          pc_ids: pcIds,
          min_area: req.min_area || "",
          max_area: req.max_area || "",
          area_unit: req.area_unit || "sqft",
          min_budget: l.min_budget || req.min_budget || "",
          max_budget: l.max_budget || req.max_budget || "",
          budget_currency: l.budget_currency || req.budget_currency || "INR",
          country: l.country || "",
          state: l.state || "",
          city: l.city || "",
          locality: l.locality || "",
          handover_preference: req.handover_preference || "",
          post_handover: req.post_handover || "",
          other_details: req.other_details || l.other_details || "",
        });
      }
      if (!cancel) setLoadingLead(false);
    })();
    return () => {
      cancel = true;
    };
  }, [editId, isEdit, fetchLead]);

  const toggleSection = (key) =>
    setOpenSections((p) => ({ ...p, [key]: !p[key] }));

  const sources = masterData?.sources || [];
  const statuses = masterData?.statuses || [];
  const priorities = masterData?.priorities || [];
  const projects = masterData?.projects || [];
  const serviceTypes = masterData?.service_types || [];
  const propertyTypes = masterData?.property_types || [];
  const configurations = masterData?.configurations || [];
  const brokers = masterData?.brokers || [];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
    if (errors[name]) setErrors((p) => ({ ...p, [name]: null }));
  };

  const validate = () => {
    const errs = {};
    if (!formData.name.trim()) errs.name = "Name is required";
    if (!formData.mobile.trim()) errs.mobile = "Mobile is required";
    else if (!/^\d{7,15}$/.test(formData.mobile.trim()))
      errs.mobile = "Enter valid mobile number";
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      errs.email = "Enter valid email";
    if (formData.source_type === "broker" && !formData.broker_id)
      errs.broker_id = "Select a broker";
    if (formData.source_type === "referral" && !formData.ref_name?.trim())
      errs.ref_name = "Referral name required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const showNotification = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    const payload = {
      name: formData.name.trim(),
      country_code: formData.country_code,
      mobile: formData.mobile.trim(),
      email: formData.email?.trim() || null,
      alt_country_code: formData.alt_mobile ? formData.alt_country_code : null,
      alt_mobile: formData.alt_mobile?.trim() || null,
      alt_email: formData.alt_email?.trim() || null,
      source_type: formData.source_type,
      src_id:
        formData.source_type === "direct" && formData.src_id
          ? parseInt(formData.src_id)
          : null,
      broker_id:
        formData.source_type === "broker" && formData.broker_id
          ? parseInt(formData.broker_id)
          : null,
      ref_name: formData.ref_name?.trim() || null,
      ref_country_code: formData.ref_mobile ? formData.ref_country_code : null,
      ref_mobile: formData.ref_mobile?.trim() || null,
      ref_email: formData.ref_email?.trim() || null,
      buyer_type: formData.buyer_type || null,
      investment_type: formData.investment_type || null,
      ls_id: formData.ls_id ? parseInt(formData.ls_id) : null,
      lp_id: formData.lp_id ? parseInt(formData.lp_id) : null,
      country: formData.country || null,
      state: formData.state || null,
      city: formData.city || null,
      locality: formData.locality?.trim() || null,
      requirements: {
        st_id: formData.st_id ? parseInt(formData.st_id) : null,
        project_ids: formData.project_ids.length ? formData.project_ids : [],
        pt_id: formData.pt_id ? parseInt(formData.pt_id) : null,
        pc_ids: formData.pc_ids.length ? formData.pc_ids : [],
        min_area: formData.min_area ? parseFloat(formData.min_area) : null,
        max_area: formData.max_area ? parseFloat(formData.max_area) : null,
        area_unit: formData.area_unit,
        min_budget: formData.min_budget
          ? parseFloat(formData.min_budget)
          : null,
        max_budget: formData.max_budget
          ? parseFloat(formData.max_budget)
          : null,
        budget_currency: formData.budget_currency,
        handover_preference: formData.handover_preference || null,
        other_details: formData.other_details?.trim() || null,
      },
    };

    const res = isEdit
      ? await updateLead(editId, payload)
      : await createLead(payload);

    // Upload document (works for both new lead and edit)
    if (res.success && document) {
      const leadId = isEdit ? editId : res.data?.lead?.l_id;
      if (leadId) {
        try {
          const fd = new FormData();
          fd.append("document", document);
          await apiFetch(`leads/${leadId}/upload-document`, {
            method: "POST",
            body: fd,
            headers: {},
          });
        } catch (err) {
          console.log("Doc upload error:", err);
        }
      }
    }

    setSaving(false);
    if (res.success) {
      showNotification(
        isEdit ? "Lead updated successfully" : "Lead created successfully",
        "success",
      );
      setTimeout(() => navigate("/leads"), 1500);
    } else {
      showNotification(
        res.message ||
          (isEdit ? "Failed to update lead" : "Failed to create lead"),
        "error",
      );
    }
  };

  const handleReset = () => {
    setFormData({ ...emptyForm });
    setErrors({});
    setDocument(null);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) setDocument(file);
  };

  return (
    <div>
      <Header
        title={isEdit ? "Edit Lead" : "Add New Lead"}
        subtitle={
          isEdit
            ? "Update lead details"
            : "Fill in the details to create a new lead"
        }
      />
      <div className="page">
        <div className="add-lead-form" style={{ maxWidth: 1000 }}>
          {/* ── Client Personal Details ── */}
          <div className="add-lead-section">
            <h3
              className="add-lead-section__title add-lead-section__title--toggle"
              onClick={() => toggleSection("personal")}
            >
              <span>Client Personal Details</span>
              <ChevronDown
                size={18}
                className={`section-chevron ${openSections.personal ? "section-chevron--open" : ""}`}
              />
            </h3>

            {openSections.personal && (
              <>
                {/* Lead Type (Source Type) as radio */}
                <div className="form-group" style={{ marginBottom: 20 }}>
                  <label className="form-label">Lead Type *</label>
                  <div style={{ display: "flex", gap: 24, marginTop: 6 }}>
                    {[
                      { v: "direct", l: "Direct" },
                      { v: "broker", l: "Broker" },
                      { v: "referral", l: "Reference" },
                    ].map((opt) => (
                      <label
                        key={opt.v}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          cursor: "pointer",
                          fontSize: 14,
                        }}
                      >
                        <input
                          type="radio"
                          name="source_type"
                          value={opt.v}
                          checked={formData.source_type === opt.v}
                          onChange={handleChange}
                        />
                        {opt.l}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="form-row">
                  {formData.source_type === "direct" && (
                    <FormSelect
                      label="Source *"
                      name="src_id"
                      value={formData.src_id}
                      onChange={handleChange}
                      options={sources.map((s) => ({
                        value: s.src_id,
                        label: s.name,
                      }))}
                      placeholder="Select Source"
                      error={errors.src_id}
                    />
                  )}
                  {formData.source_type === "broker" && (
                    <FormSelect
                      label="Broker *"
                      name="broker_id"
                      value={formData.broker_id}
                      onChange={handleChange}
                      options={brokers.map((b) => ({
                        value: b.b_id,
                        label:
                          b.broker_name +
                          (b.company ? " (" + b.company + ")" : ""),
                      }))}
                      placeholder="Select Broker"
                      error={errors.broker_id}
                    />
                  )}
                  {formData.source_type === "referral" && (
                    <FormInput
                      label="Referral Name *"
                      name="ref_name"
                      value={formData.ref_name}
                      onChange={handleChange}
                      placeholder="Enter referral name"
                      error={errors.ref_name}
                    />
                  )}
                  <FormInput
                    label="Lead Name *"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Enter Lead Name"
                    error={errors.name}
                  />
                </div>

                <div className="form-row">
                  <div style={{ display: "flex", gap: 8 }}>
                    <div style={{ width: 110 }}>
                      <FormSelect
                        label="Mobile No. *"
                        name="country_code"
                        value={formData.country_code}
                        onChange={handleChange}
                        options={COUNTRY_CODES}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <FormInput
                        label="&nbsp;"
                        name="mobile"
                        value={formData.mobile}
                        onChange={handleChange}
                        placeholder="+91"
                        error={errors.mobile}
                      />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <div style={{ width: 110 }}>
                      <FormSelect
                        label="Alt. Mobile No."
                        name="alt_country_code"
                        value={formData.alt_country_code}
                        onChange={handleChange}
                        options={COUNTRY_CODES}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <FormInput
                        label="&nbsp;"
                        name="alt_mobile"
                        value={formData.alt_mobile}
                        onChange={handleChange}
                        placeholder="+91"
                      />
                    </div>
                  </div>
                </div>

                <div className="form-row">
                  <FormInput
                    label="Email Id."
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="Enter Email Id."
                    error={errors.email}
                  />
                  {formData.source_type === "referral" && (
                    <FormInput
                      label="Referral Mobile"
                      name="ref_mobile"
                      value={formData.ref_mobile}
                      onChange={handleChange}
                      placeholder="Referral mobile"
                    />
                  )}
                </div>
              </>
            )}
          </div>

          {/* ── Client Requirement Details ── */}
          <div className="add-lead-section">
            <h3
              className="add-lead-section__title add-lead-section__title--toggle"
              onClick={() => toggleSection("requirements")}
            >
              <span>Client Requirement Details</span>
              <ChevronDown
                size={18}
                className={`section-chevron ${openSections.requirements ? "section-chevron--open" : ""}`}
              />
            </h3>

            {openSections.requirements && (
              <>
                <div className="form-row">
                  <FormSelect
                    label="Project Name"
                    name="project_id"
                    value={formData.project_ids[0] || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData((p) => ({
                        ...p,
                        project_ids: val ? [parseInt(val)] : [],
                      }));
                    }}
                    options={projects.map((p) => ({
                      value: p.proj_id,
                      label: p.name,
                    }))}
                    placeholder="Select Project Name"
                  />
                  <FormSelect
                    label="Service Type"
                    name="st_id"
                    value={formData.st_id}
                    onChange={handleChange}
                    options={serviceTypes.map((s) => ({
                      value: s.st_id,
                      label: s.name,
                    }))}
                    placeholder="Select Service Type"
                  />
                </div>

                <div className="form-row">
                  <FormSelect
                    label="Property Type"
                    name="pt_id"
                    value={formData.pt_id}
                    onChange={handleChange}
                    options={propertyTypes.map((t) => ({
                      value: t.pt_id,
                      label: t.name,
                    }))}
                    placeholder="Select Property Type"
                  />
                  <FormSelect
                    label="Configuration"
                    name="pc_id"
                    value={formData.pc_ids[0] || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData((p) => ({
                        ...p,
                        pc_ids: val ? [parseInt(val)] : [],
                      }));
                    }}
                    options={configurations.map((c) => ({
                      value: c.pc_id,
                      label: c.name,
                    }))}
                    placeholder="Select Configuration"
                  />
                </div>

                {/* Property Area */}
                <div className="form-row form-row--3">
                  <FormSelect
                    label="Property Area"
                    name="area_unit"
                    value={formData.area_unit}
                    onChange={handleChange}
                    options={AREA_UNITS}
                  />
                  <FormInput
                    label="Min Area"
                    name="min_area"
                    value={formData.min_area}
                    onChange={handleChange}
                    placeholder="Enter Minimum Area"
                    type="number"
                  />
                  <FormInput
                    label="Max Area"
                    name="max_area"
                    value={formData.max_area}
                    onChange={handleChange}
                    placeholder="Enter Maximum Area"
                    type="number"
                  />
                </div>

                {/* Property Price */}
                <div className="form-row form-row--3">
                  <FormSelect
                    label="Property Price"
                    name="budget_currency"
                    value={formData.budget_currency}
                    onChange={handleChange}
                    options={CURRENCIES}
                  />
                  <FormInput
                    label="Min Price"
                    name="min_budget"
                    value={formData.min_budget}
                    onChange={handleChange}
                    placeholder="Enter Minimum Price"
                    type="number"
                  />
                  <FormInput
                    label="Max Price"
                    name="max_budget"
                    value={formData.max_budget}
                    onChange={handleChange}
                    placeholder="Enter Maximum Price"
                    type="number"
                  />
                </div>

                {/* Location */}
                <div className="form-row">
                  <FormInput
                    label="Location"
                    name="locality"
                    value={formData.locality}
                    onChange={handleChange}
                    placeholder="Enter Locality"
                  />
                  <FormSelect
                    label="City"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    options={CITIES_MAHARASHTRA.map((c) => ({
                      value: c,
                      label: c,
                    }))}
                    placeholder="Select City"
                  />
                </div>

                <div className="form-row">
                  <FormSelect
                    label="State"
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    options={STATES_INDIA.map((s) => ({ value: s, label: s }))}
                    placeholder="Select State"
                  />
                  <FormSelect
                    label="Country"
                    name="country"
                    value={formData.country}
                    onChange={handleChange}
                    options={COUNTRIES.map((c) => ({ value: c, label: c }))}
                    placeholder="Select Country"
                  />
                </div>

                {/* Other Details + Document */}
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Other Details</label>
                    <textarea
                      className="form-input"
                      name="other_details"
                      value={formData.other_details}
                      onChange={handleChange}
                      rows="4"
                      placeholder="Enter Other Details ...."
                      style={{ resize: "vertical", minHeight: "100px" }}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Document</label>
                    {document ? (
                      <div className="add-lead-file-preview">
                        <FileText size={20} />
                        <span className="add-lead-file-name">
                          {document.name}
                        </span>
                        <button
                          className="add-lead-file-remove"
                          onClick={() => {
                            setDocument(null);
                            if (fileRef.current) fileRef.current.value = "";
                          }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div
                        className="add-lead-upload"
                        onClick={() => fileRef.current?.click()}
                      >
                        <Upload
                          size={20}
                          style={{ color: "var(--gold-500)" }}
                        />
                        <span>Drag & drop a file here or click to select</span>
                        <input
                          ref={fileRef}
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                          onChange={handleFileSelect}
                          style={{ display: "none" }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ── Classification ── */}
          <div className="add-lead-section">
            <h3
              className="add-lead-section__title add-lead-section__title--toggle"
              onClick={() => toggleSection("classification")}
            >
              <span>Classification</span>
              <ChevronDown
                size={18}
                className={`section-chevron ${openSections.classification ? "section-chevron--open" : ""}`}
              />
            </h3>

            {openSections.classification && (
              <>
                <div className="form-row">
                  <FormSelect
                    label="Type of Buyer"
                    name="buyer_type"
                    value={formData.buyer_type}
                    onChange={handleChange}
                    options={BUYER_TYPES.map((b) => ({ value: b, label: b }))}
                    placeholder="Select Type Of Buyer"
                  />
                  <FormSelect
                    label="Investment Type"
                    name="investment_type"
                    value={formData.investment_type}
                    onChange={handleChange}
                    options={INVESTMENT_TYPES.map((i) => ({
                      value: i,
                      label: i,
                    }))}
                    placeholder="Investment Type"
                  />
                </div>

                <div className="form-row">
                  <FormSelect
                    label="Post Handover"
                    name="post_handover"
                    value={formData.post_handover}
                    onChange={handleChange}
                    options={POST_HANDOVER.map((p) => ({ value: p, label: p }))}
                    placeholder="Post Handover"
                  />
                  <FormSelect
                    label="Handover Year"
                    name="handover_preference"
                    value={formData.handover_preference}
                    onChange={handleChange}
                    options={HANDOVER_YEARS.map((y) => ({
                      value: y,
                      label: y,
                    }))}
                    placeholder="Handover Year"
                  />
                </div>

                <div className="form-row">
                  <FormSelect
                    label="Status"
                    name="ls_id"
                    value={formData.ls_id}
                    onChange={handleChange}
                    options={statuses.map((s) => ({
                      value: s.ls_id,
                      label: s.name,
                    }))}
                    placeholder="Select Status"
                  />
                  <FormSelect
                    label="Priority"
                    name="lp_id"
                    value={formData.lp_id}
                    onChange={handleChange}
                    options={priorities.map((p) => ({
                      value: p.lp_id,
                      label: p.name,
                    }))}
                    placeholder="Select Priority"
                  />
                </div>
              </>
            )}
          </div>

          {/* ── Actions ── */}
          <div className="add-lead-actions">
            <Button variant="outline" icon={RotateCcw} onClick={handleReset}>
              Reset
            </Button>
            <Button
              variant="gold"
              icon={Save}
              size="lg"
              onClick={handleSubmit}
              disabled={saving || loadingLead}
            >
              {saving ? "Saving..." : isEdit ? "Update Lead" : "Save Lead"}
            </Button>
          </div>
        </div>
      </div>

      {toast?.message && (
        <div
          className={`toast toast--${toast.type}`}
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            padding: "12px 16px",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 500,
            zIndex: 9999,
            backgroundColor: toast.type === "success" ? "#10b981" : "#ef4444",
            color: "white",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            animation: "slideIn 0.3s ease-out",
          }}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
};
export default AddLead;
