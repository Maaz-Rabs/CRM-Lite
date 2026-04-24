// ============================================================================
// SEED UTILITY - Create first Master user
// Run: node utils/seed.js
// This will hash a password and give you the INSERT query
// ============================================================================

const bcrypt = require('bcryptjs');

const seedUser = async () => {
  const username = process.argv[2] || 'admin';
  const password = process.argv[3] || 'admin123';
  const roleId = parseInt(process.argv[4] || '1'); // 1 = Master

  const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12');
  const hash = await bcrypt.hash(password, saltRounds);

  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  RABS Connect - User Seed');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  console.log(`  Username  : ${username}`);
  console.log(`  Password  : ${password}`);
  console.log(`  Role ID   : ${roleId}`);
  console.log(`  Hash      : ${hash}`);
  console.log('');
  console.log('  ── SQL INSERT ──');
  console.log('');
  console.log(`  INSERT INTO users (role_id, username, password_hash, email, is_active)`);
  console.log(`  VALUES (${roleId}, '${username}', '${hash}', '${username}@rabsconnect.com', 1);`);
  console.log('');
  console.log(`  INSERT INTO user_profiles (user_id, first_name, last_name)`);
  console.log(`  VALUES (LAST_INSERT_ID(), 'Admin', 'User');`);
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  console.log('  Usage: node utils/seed.js [username] [password] [role_id]');
  console.log('  Example: node utils/seed.js rabs mypassword 1');
  console.log('');
};

seedUser().catch(console.error);
