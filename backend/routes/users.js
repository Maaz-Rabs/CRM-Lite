/**
 * User Routes
 * All user/team member related API endpoints
 */

const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');
const { uploadPhoto, handleUploadError } = require('../middleware/upload');

// All routes require authentication
router.use(authenticate);

// Profile update (own profile) - must be before /:id routes
router.put('/profile', userController.updateProfile);

// Profile image upload
router.post('/profile/image', uploadPhoto.single('profile_image'), handleUploadError, userController.uploadProfileImage);

// Profile image delete
router.delete('/profile/image', userController.deleteProfileImage);

// Change password
router.post('/change-password', userController.changePassword);

// CRUD operations
router.get('/', userController.getUsers);
router.get('/:id', userController.getUser);
router.post('/', userController.createUser);
router.put('/:id', userController.updateUser);
router.delete('/:id', userController.deleteUser);

// Delete info (lead count + eligible reassignment users)
router.get('/:id/delete-info', userController.getDeleteInfo);

// Permissions
router.get('/:id/permissions', userController.getUserPermissions);

// Toggle status
router.patch('/:id/status', userController.toggleStatus);

module.exports = router;
