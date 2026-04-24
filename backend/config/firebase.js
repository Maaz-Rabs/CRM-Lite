// ============================================================================
// FIREBASE ADMIN INITIALIZATION
// ============================================================================

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const serviceAccountPath = path.join(__dirname, 'firebase-service-account.json');

if (fs.existsSync(serviceAccountPath)) {
  const serviceAccount = require(serviceAccountPath);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  console.log('[FIREBASE] Admin SDK initialized successfully');
} else {
  console.warn('[FIREBASE] Service account key not found at:', serviceAccountPath);
  console.warn('[FIREBASE] Push notifications will NOT work until firebase-service-account.json is added');
}

module.exports = admin;
