const { body } = require('express-validator');

// Validation rules for creating a broker
const createBrokerValidation = [
  body('broker_name')
    .notEmpty()
    .withMessage('Broker name is required')
    .trim()
    .isLength({ min: 2, max: 255 })
    .withMessage('Broker name must be between 2 and 255 characters'),

  body('broker_email')
    .optional({ nullable: true, checkFalsy: true })
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),

  body('country_code')
    .optional()
    .trim()
    .matches(/^\+\d{1,4}$/)
    .withMessage('Invalid country code format'),

  body('mobile_no')
    .notEmpty()
    .withMessage('Mobile number is required')
    .trim()
    .matches(/^\d{7,15}$/)
    .withMessage('Mobile number must be 7-15 digits'),

  body('company')
    .notEmpty()
    .withMessage('Company name is required')
    .trim()
    .isLength({ min: 2, max: 255 })
    .withMessage('Company name must be between 2 and 255 characters'),

  body('rera_no')
    .notEmpty()
    .withMessage('RERA number is required')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('RERA number must be between 1 and 100 characters'),

  body('location')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 255 })
    .withMessage('Location must not exceed 255 characters'),

  body('address')
    .notEmpty()
    .withMessage('Address is required')
    .trim()
    .isLength({ min: 5 })
    .withMessage('Address must be at least 5 characters'),

  body('remark')
    .optional({ nullable: true, checkFalsy: true })
    .trim(),

  body('status')
    .optional()
    .isIn(['active', 'inactive', 'suspended'])
    .withMessage('Status must be active, inactive, or suspended'),

  body('commission_percentage')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Commission percentage must be between 0 and 100'),

  body('specialization')
    .optional()
    .isIn(['residential', 'commercial', 'both'])
    .withMessage('Specialization must be residential, commercial, or both'),

  body('license_expiry_date')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601()
    .withMessage('Invalid date format'),

  body('experience_years')
    .optional()
    .isInt({ min: 0, max: 50 })
    .withMessage('Experience years must be between 0 and 50')
];

// Validation rules for updating a broker
const updateBrokerValidation = [
  body('broker_name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 255 })
    .withMessage('Broker name must be between 2 and 255 characters'),

  body('broker_email')
    .optional({ nullable: true, checkFalsy: true })
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),

  body('country_code')
    .optional()
    .trim()
    .matches(/^\+\d{1,4}$/)
    .withMessage('Invalid country code format'),

  body('mobile_no')
    .optional()
    .trim()
    .matches(/^\d{7,15}$/)
    .withMessage('Mobile number must be 7-15 digits'),

  body('company')
    .optional()
    .trim()
    .isLength({ min: 2, max: 255 })
    .withMessage('Company name must be between 2 and 255 characters'),

  body('rera_no')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('RERA number must be between 1 and 100 characters'),

  body('location')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 255 })
    .withMessage('Location must not exceed 255 characters'),

  body('address')
    .optional()
    .trim()
    .isLength({ min: 5 })
    .withMessage('Address must be at least 5 characters'),

  body('remark')
    .optional({ nullable: true, checkFalsy: true })
    .trim(),

  body('status')
    .optional()
    .isIn(['active', 'inactive', 'suspended'])
    .withMessage('Status must be active, inactive, or suspended'),

  body('commission_percentage')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Commission percentage must be between 0 and 100'),

  body('specialization')
    .optional()
    .isIn(['residential', 'commercial', 'both'])
    .withMessage('Specialization must be residential, commercial, or both'),

  body('license_expiry_date')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601()
    .withMessage('Invalid date format'),

  body('experience_years')
    .optional()
    .isInt({ min: 0, max: 50 })
    .withMessage('Experience years must be between 0 and 50')
];

module.exports = {
  createBrokerValidation,
  updateBrokerValidation
};
