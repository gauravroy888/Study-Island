import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

describe('Aria AI Bot Singleton Guarantee & Iframe Isolation', () => {
  const botWidgetPath = path.join(ROOT, 'bot-widget.js');
  const reactAITutorPath = path.join(ROOT, 'study-island', 'src', 'components', 'AITutorWidget.jsx');

  test('bot-widget.js exists and implements iframe defense', () => {
    assert.ok(fs.existsSync(botWidgetPath), 'bot-widget.js exists');
    const content = fs.readFileSync(botWidgetPath, 'utf8');

    // Asserts iframe detection
    assert.ok(
      content.includes('window.self !== window.top'),
      'bot-widget.js must check window.self !== window.top to prevent rendering inside iframes'
    );
  });

  test('bot-widget.js implements top-level document singleton guard', () => {
    const content = fs.readFileSync(botWidgetPath, 'utf8');

    // Asserts global singleton flag
    assert.ok(
      content.includes('__aria_bot_widget_initialized__'),
      'bot-widget.js must guard against duplicate executions using __aria_bot_widget_initialized__'
    );
  });

  test('study-island/src/components/AITutorWidget.jsx implements iframe defense', () => {
    assert.ok(fs.existsSync(reactAITutorPath), 'AITutorWidget.jsx exists');
    const content = fs.readFileSync(reactAITutorPath, 'utf8');

    assert.ok(
      content.includes('window.self !== window.top'),
      'AITutorWidget.jsx must check window.self !== window.top to prevent rendering inside iframes'
    );
    assert.ok(
      content.includes('if (isIframe)'),
      'AITutorWidget.jsx must return null when inside an iframe'
    );
  });

  test('study-island/src/components/AITutorWidget.jsx publishes active singleton lifecycle state', () => {
    const content = fs.readFileSync(reactAITutorPath, 'utf8');

    assert.ok(
      content.includes('__aria_widget_active__'),
      'AITutorWidget.jsx must track active status via window.__aria_widget_active__'
    );
  });
});
