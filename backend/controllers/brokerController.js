const Broker = require('../models/Broker');
const { validationResult } = require('express-validator');
const path = require('path');
const fs = require('fs');

// Get all brokers with pagination
exports.getAllBrokers = async (req, res) => {
  try {
    const brokerModel = new Broker(req.db);
    const {
      page = 1,
      limit = 20,
      search = '',
      status = '',
      specialization = '',
      location = '',
      created_from = '',
      created_to = '',
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    const result = await brokerModel.getAll({
      page: parseInt(page),
      limit: parseInt(limit),
      search,
      status,
      specialization,
      location,
      created_from,
      created_to,
      sortBy,
      sortOrder
    });

    res.status(200).json({
      success: true,
      message: 'Brokers fetched successfully',
      ...result
    });
  } catch (error) {
    console.error('Error fetching brokers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch brokers',
      error: error.message
    });
  }
};

// Get single broker by ID
exports.getBrokerById = async (req, res) => {
  try {
    const brokerModel = new Broker(req.db);
    const { id } = req.params;
    const broker = await brokerModel.getById(id);

    if (!broker) {
      return res.status(404).json({
        success: false,
        message: 'Broker not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Broker fetched successfully',
      data: broker
    });
  } catch (error) {
    console.error('Error fetching broker:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch broker',
      error: error.message
    });
  }
};

// Create new broker
exports.createBroker = async (req, res) => {
  try {
    const brokerModel = new Broker(req.db);

    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      broker_name,
      broker_email,
      country_code = '+971',
      mobile_no,
      company,
      rera_no,
      location,
      address,
      remark,
      status,
      commission_percentage,
      specialization,
      license_expiry_date,
      languages,
      experience_years
    } = req.body;

    // Check if broker already exists with same RERA or mobile
    const existingBrokers = await brokerModel.checkExists(rera_no, country_code, mobile_no);
    if (existingBrokers.length > 0) {
      const existing = existingBrokers[0];
      if (existing.rera_no === rera_no) {
        return res.status(409).json({
          success: false,
          message: 'A broker with this RERA number already exists'
        });
      }
      if (existing.mobile_no === mobile_no) {
        return res.status(409).json({
          success: false,
          message: 'A broker with this mobile number already exists'
        });
      }
    }

    // Handle file uploads
    let document_path = null;
    let document_name = null;
    let profile_photo = null;

    if (req.files) {
      if (req.files.document && req.files.document[0]) {
        document_path = `/uploads/documents/${req.files.document[0].filename}`;
        document_name = req.files.document[0].originalname;
      }
      if (req.files.profile_photo && req.files.profile_photo[0]) {
        profile_photo = `/uploads/photos/${req.files.profile_photo[0].filename}`;
      }
    }

    // Parse languages if it's a string
    let parsedLanguages = languages;
    if (typeof languages === 'string') {
      try {
        parsedLanguages = JSON.parse(languages);
      } catch (e) {
        parsedLanguages = languages.split(',').map(l => l.trim());
      }
    }

    const brokerData = {
      broker_name,
      broker_email,
      country_code,
      mobile_no,
      company,
      rera_no,
      location,
      address,
      remark,
      document_path,
      document_name,
      status: status || 'active',
      commission_percentage: parseFloat(commission_percentage) || 0,
      specialization: specialization || 'both',
      profile_photo,
      license_expiry_date: license_expiry_date || null,
      languages: parsedLanguages,
      experience_years: parseInt(experience_years) || 0,
      created_by: req.user?.userId || null
    };

    const newBroker = await brokerModel.create(brokerData);

    res.status(201).json({
      success: true,
      message: 'Broker created successfully',
      data: newBroker
    });
  } catch (error) {
    console.error('Error creating broker:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create broker',
      error: error.message
    });
  }
};

// Update broker
exports.updateBroker = async (req, res) => {
  try {
    const brokerModel = new Broker(req.db);

    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;

    // Check if broker exists
    const existingBroker = await brokerModel.getById(id);
    if (!existingBroker) {
      return res.status(404).json({
        success: false,
        message: 'Broker not found'
      });
    }

    const {
      broker_name,
      broker_email,
      country_code,
      mobile_no,
      company,
      rera_no,
      location,
      address,
      remark,
      status,
      commission_percentage,
      specialization,
      license_expiry_date,
      languages,
      experience_years
    } = req.body;

    // Check for duplicate RERA or mobile (excluding current broker)
    if (rera_no || mobile_no) {
      const checkRera = rera_no || existingBroker.rera_no;
      const checkCode = country_code || existingBroker.country_code;
      const checkMobile = mobile_no || existingBroker.mobile_no;

      const duplicates = await brokerModel.checkExists(checkRera, checkCode, checkMobile, id);
      if (duplicates.length > 0) {
        const dup = duplicates[0];
        if (dup.rera_no === checkRera) {
          return res.status(409).json({
            success: false,
            message: 'A broker with this RERA number already exists'
          });
        }
        if (dup.mobile_no === checkMobile) {
          return res.status(409).json({
            success: false,
            message: 'A broker with this mobile number already exists'
          });
        }
      }
    }

    // Handle file uploads
    let document_path = undefined;
    let document_name = undefined;
    let profile_photo = undefined;

    if (req.files) {
      if (req.files.document && req.files.document[0]) {
        document_path = `/uploads/documents/${req.files.document[0].filename}`;
        document_name = req.files.document[0].originalname;

        // Delete old document if exists
        if (existingBroker.document_path) {
          const oldPath = path.join(__dirname, '..', existingBroker.document_path);
          if (fs.existsSync(oldPath)) {
            fs.unlinkSync(oldPath);
          }
        }
      }
      if (req.files.profile_photo && req.files.profile_photo[0]) {
        profile_photo = `/uploads/photos/${req.files.profile_photo[0].filename}`;

        // Delete old photo if exists
        if (existingBroker.profile_photo) {
          const oldPath = path.join(__dirname, '..', existingBroker.profile_photo);
          if (fs.existsSync(oldPath)) {
            fs.unlinkSync(oldPath);
          }
        }
      }
    }

    // Parse languages if it's a string
    let parsedLanguages = languages;
    if (typeof languages === 'string') {
      try {
        parsedLanguages = JSON.parse(languages);
      } catch (e) {
        parsedLanguages = languages.split(',').map(l => l.trim());
      }
    }

    const updateData = {
      ...(broker_name && { broker_name }),
      ...(broker_email !== undefined && { broker_email }),
      ...(country_code && { country_code }),
      ...(mobile_no && { mobile_no }),
      ...(company && { company }),
      ...(rera_no && { rera_no }),
      ...(location !== undefined && { location }),
      ...(address && { address }),
      ...(remark !== undefined && { remark }),
      ...(document_path && { document_path }),
      ...(document_name && { document_name }),
      ...(status && { status }),
      ...(commission_percentage !== undefined && { commission_percentage: parseFloat(commission_percentage) }),
      ...(specialization && { specialization }),
      ...(profile_photo && { profile_photo }),
      ...(license_expiry_date !== undefined && { license_expiry_date: license_expiry_date || null }),
      ...(parsedLanguages && { languages: parsedLanguages }),
      ...(experience_years !== undefined && { experience_years: parseInt(experience_years) }),
      updated_by: req.user?.userId || null
    };

    const updated = await brokerModel.update(id, updateData);

    if (!updated) {
      return res.status(400).json({
        success: false,
        message: 'Failed to update broker'
      });
    }

    // Fetch updated broker
    const updatedBroker = await brokerModel.getById(id);

    res.status(200).json({
      success: true,
      message: 'Broker updated successfully',
      data: updatedBroker
    });
  } catch (error) {
    console.error('Error updating broker:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update broker',
      error: error.message
    });
  }
};

// Delete broker (soft delete)
exports.deleteBroker = async (req, res) => {
  try {
    const brokerModel = new Broker(req.db);
    const { id } = req.params;

    // Check if broker exists
    const existingBroker = await brokerModel.getById(id);
    if (!existingBroker) {
      return res.status(404).json({
        success: false,
        message: 'Broker not found'
      });
    }

    const deleted = await brokerModel.delete(id, req.user?.userId);

    if (!deleted) {
      return res.status(400).json({
        success: false,
        message: 'Failed to delete broker'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Broker deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting broker:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete broker',
      error: error.message
    });
  }
};

// Update broker status
exports.updateBrokerStatus = async (req, res) => {
  try {
    const brokerModel = new Broker(req.db);
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'inactive', 'suspended'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be active, inactive, or suspended'
      });
    }

    // Check if broker exists
    const existingBroker = await brokerModel.getById(id);
    if (!existingBroker) {
      return res.status(404).json({
        success: false,
        message: 'Broker not found'
      });
    }

    const updated = await brokerModel.updateStatus(id, status, req.user?.userId);

    if (!updated) {
      return res.status(400).json({
        success: false,
        message: 'Failed to update broker status'
      });
    }

    res.status(200).json({
      success: true,
      message: `Broker status updated to ${status}`
    });
  } catch (error) {
    console.error('Error updating broker status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update broker status',
      error: error.message
    });
  }
};

// Get broker statistics
exports.getBrokerStats = async (req, res) => {
  try {
    const brokerModel = new Broker(req.db);
    const stats = await brokerModel.getStats();

    res.status(200).json({
      success: true,
      message: 'Broker statistics fetched successfully',
      data: stats
    });
  } catch (error) {
    console.error('Error fetching broker stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch broker statistics',
      error: error.message
    });
  }
};

// Upload additional document
exports.uploadDocument = async (req, res) => {
  try {
    const brokerModel = new Broker(req.db);
    const { id } = req.params;
    const { document_type = 'other' } = req.body;

    // Check if broker exists
    const broker = await brokerModel.getById(id);
    if (!broker) {
      return res.status(404).json({
        success: false,
        message: 'Broker not found'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No document file provided'
      });
    }

    const documentData = {
      document_type,
      document_name: req.file.originalname,
      document_path: `/uploads/documents/${req.file.filename}`
    };

    const document = await brokerModel.addDocument(id, documentData);

    res.status(201).json({
      success: true,
      message: 'Document uploaded successfully',
      data: document
    });
  } catch (error) {
    console.error('Error uploading document:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload document',
      error: error.message
    });
  }
};

// Get broker notes
exports.getBrokerNotes = async (req, res) => {
  try {
    const brokerModel = new Broker(req.db);
    const { id } = req.params;
    const notes = await brokerModel.getNotes(id);

    res.status(200).json({
      success: true,
      data: notes
    });
  } catch (error) {
    console.error('Error fetching broker notes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch broker notes',
      error: error.message
    });
  }
};

// Add broker note
exports.addBrokerNote = async (req, res) => {
  try {
    const brokerModel = new Broker(req.db);
    const { id } = req.params;
    const { note } = req.body;

    if (!note || !note.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Note text is required'
      });
    }

    const newNote = await brokerModel.addNote(id, note.trim(), req.user?.userId || null);

    res.status(201).json({
      success: true,
      message: 'Note added successfully',
      data: newNote
    });
  } catch (error) {
    console.error('Error adding broker note:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add note',
      error: error.message
    });
  }
};

// Delete broker note
exports.deleteBrokerNote = async (req, res) => {
  try {
    const brokerModel = new Broker(req.db);
    const { noteId } = req.params;

    const deleted = await brokerModel.deleteNote(noteId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Note not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Note deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting broker note:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete note',
      error: error.message
    });
  }
};

// Delete document
exports.deleteDocument = async (req, res) => {
  try {
    const brokerModel = new Broker(req.db);
    const { documentId } = req.params;

    const deleted = await brokerModel.removeDocument(documentId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete document',
      error: error.message
    });
  }
};
