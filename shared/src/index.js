/**
 * EdTech Island Shared Module Entrypoint
 * ─────────────────────────────────────────────────────────────────────────────
 * Actively imported across portals:
 *   - ./lib/supabase.js              (Teacher, Admin, Student, SuperAdmin portals)
 *   - ./theme/presets.js             (Teacher, Admin, Student portals ThemeContext)
 *   - ./components/ProfilePhotoModal (Teacher, Admin, Student portals modal)
 *
 * Domain Service Modules (tested and available for cross-portal consumption):
 *   - ./services/classService.js     (Tested via tests/roster.test.js)
 *   - ./services/testService.js      (Assessment & quiz management service)
 *   - ./services/userService.js      (Safe profile retrieval service)
 *   - ./services/chatService.js      (Chat messaging service)
 *   - ./services/announcementService (Broadcast announcements service)
 */

export * from './lib/supabase.js';
export * from './services/classService.js';
export * from './services/testService.js';
export * from './services/userService.js';
export * from './services/chatService.js';
export * from './services/announcementService.js';
export * from './theme/presets.js';
export { default as ProfilePhotoModal } from './components/ProfilePhotoModal.jsx';
