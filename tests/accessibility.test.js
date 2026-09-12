import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Phase 4: WCAG 2.2 Accessibility Standards Verification', () => {

  test('A11Y-01: All root HTML files declare lang attribute for screen readers', () => {
    const htmlFiles = [
      'index.html',
      'login.html',
      'superadmin-login.html',
      'b2b.html',
      'portals/student/index.html',
      'portals/teacher/index.html',
      'portals/admin/index.html',
      'portals/superadmin/index.html',
      'study-island/index.html'
    ];

    for (const relPath of htmlFiles) {
      if (fs.existsSync(relPath)) {
        const content = fs.readFileSync(relPath, 'utf8');
        assert.match(
          content,
          /<html[^>]*\slang=["'][a-z]{2}(-[A-Z]{2})?["']/i,
          `File ${relPath} must specify a valid html lang attribute (WCAG 3.1.1 Language of Page)`
        );
      }
    }
  });

  test('A11Y-02: styles.css contains WCAG 2.2 compliant :focus-visible rules with >= 2px outline', () => {
    const css = fs.readFileSync('styles.css', 'utf8');
    assert.match(
      css,
      /:focus-visible/i,
      'styles.css must include :focus-visible rule for keyboard navigation'
    );
    assert.match(
      css,
      /outline:\s*2px\s+solid/i,
      'styles.css must enforce minimum 2px visible focus outline (WCAG 2.4.11 / 2.4.13 Focus Appearance)'
    );
  });

  test('A11Y-03: styles.css contains @media (prefers-reduced-motion: reduce) for vestibular disorder safety', () => {
    const css = fs.readFileSync('styles.css', 'utf8');
    assert.match(
      css,
      /@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)/i,
      'styles.css must honor user prefers-reduced-motion preferences (WCAG 2.3.3 Animation from Interactions)'
    );
    assert.match(
      css,
      /animation-duration:\s*0\.01ms/i,
      'prefers-reduced-motion must minimize or disable CSS animations'
    );
  });

  test('A11Y-04: ProfilePhotoModal implements ARIA dialog role, aria-modal, and Escape key handling', () => {
    const modalPath = 'shared/src/components/ProfilePhotoModal.jsx';
    assert.ok(fs.existsSync(modalPath), 'ProfilePhotoModal.jsx must exist');
    const content = fs.readFileSync(modalPath, 'utf8');

    assert.match(content, /role="dialog"/i, 'Modal must have role="dialog"');
    assert.match(content, /aria-modal="true"/i, 'Modal must declare aria-modal="true"');
    assert.match(content, /aria-labelledby/i, 'Modal must have aria-labelledby linking to modal title');
    assert.match(content, /e\.key === 'Escape'/i, 'Modal must listen for Escape key to close (WCAG 2.1.2 No Keyboard Trap)');
    assert.match(content, /e\.key === 'Tab'/i, 'Modal must implement Tab focus trapping (WCAG 2.4.3 Focus Order)');
  });

  test('A11Y-05: Modal interactive buttons and file controls provide accessible names', () => {
    const modalPath = 'shared/src/components/ProfilePhotoModal.jsx';
    const content = fs.readFileSync(modalPath, 'utf8');

    assert.match(content, /aria-label="Close profile photo modal"/i, 'Close button must have aria-label');
    assert.match(content, /aria-label="Upload profile image"/i, 'File input must have aria-label');
    assert.match(content, /aria-label="Zoom image slider"/i, 'Zoom slider must have aria-label');
  });

  test('A11Y-06: Form inputs on login.html have associated labels or accessible placeholders', () => {
    const loginHtml = fs.readFileSync('login.html', 'utf8');
    assert.match(loginHtml, /<label>Student ID \/ Email<\/label>/i);
    assert.match(loginHtml, /<label>Educator Email \/ Login ID<\/label>/i);
    assert.match(loginHtml, /<label>Administrator Email \/ Login ID<\/label>/i);
  });
});
