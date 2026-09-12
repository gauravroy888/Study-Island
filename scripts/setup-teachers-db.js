/**
 * DEPRECATED: Legacy teacher setup script.
 * Teachers are now managed through canonical profiles and class_teachers tables
 * under strict multi-tenant Row-Level Security (RLS).
 *
 * This script is retained as a no-op placeholder to prevent breaking legacy references.
 */
require('dotenv').config();

function setupTeachersDb() {
  console.log('ℹ️ setup-teachers-db is deprecated. Teacher assignments are handled via class_teachers and profiles.');
}

if (require.main === module) {
  setupTeachersDb();
}

module.exports = { setupTeachersDb };
