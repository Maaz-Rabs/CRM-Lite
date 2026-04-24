/**
 * Location Routes
 */
const express = require('express');
const router = express.Router();
const locationController = require('../controllers/locationController');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Update own location (called periodically by mobile app)
router.post('/update', locationController.updateLocation);

// Get team members' locations (for TrackUserScreen)
router.get('/team', locationController.getTeamLocations);

// Request location from a user
router.post('/request', locationController.requestLocation);

// Respond to a location request
router.post('/request/:id/respond', locationController.respondLocationRequest);

// Get pending location requests for current user
router.get('/requests/pending', locationController.getPendingRequests);

module.exports = router;
