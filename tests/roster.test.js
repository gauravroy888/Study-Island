import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Data Privacy: Class Roster Leak Prevention', () => {
  const ROSTER_SERVICE_FILE = path.resolve(import.meta.dirname, '..', 'shared', 'src', 'services', 'classService.js');

  test('classService.js must NOT contain fallback query fetching all profiles', () => {
    assert.ok(fs.existsSync(ROSTER_SERVICE_FILE), 'classService.js exists');
    const content = fs.readFileSync(ROSTER_SERVICE_FILE, 'utf8');

    // Check that the vulnerable fallback pattern is completely eradicated
    const hasVulnerableFallback = content.includes("supabase.from('profiles').select('*')") ||
      content.includes('from("profiles").select("*")') ||
      (content.includes('.from(\'profiles\')') && content.includes('.eq(\'role\', \'student\')'));

    assert.strictEqual(
      hasVulnerableFallback,
      false,
      'CRITICAL: classService.js still contains fallback query that dumps all student profiles from database!'
    );
  });

  test('classService.js queries real class_students table rather than non-existent student_enrollments', () => {
    const content = fs.readFileSync(ROSTER_SERVICE_FILE, 'utf8');

    assert.ok(
      !content.includes("'student_enrollments'"),
      'classService.js still references non-existent table student_enrollments'
    );

    assert.ok(
      content.includes("'class_students'") || content.includes('"class_students"'),
      'classService.js must query real PostgreSQL table class_students'
    );
  });
});
