/**
 * sheets-quiz-sync.js
 * 
 * Google Sheets Quiz Integration & Parsing Module for EdTech Island.
 * Parses published Google Sheets CSV or JSON exports into standardized
 * EdTech Island quiz schemas, validates rows, and provides offline fallback.
 */

import defaultQuizData from '../data/sample_chapter_quiz.json';

// Valid Bloom taxonomy levels recognized by analytics & mastery pipeline
export const VALID_BLOOM_LEVELS = [
  'remember',
  'understand',
  'apply',
  'analyze',
  'evaluate',
  'create'
];

// Valid difficulty tiers recognized by difficulty weighting pipeline
export const VALID_DIFFICULTIES = [
  'easy',
  'medium',
  'hard'
];

// Mandatory columns for any quiz spreadsheet
export const REQUIRED_COLUMNS = [
  'question_id',
  'section_id',
  'text',
  'option_a',
  'option_b',
  'option_c',
  'option_d',
  'correct_option'
];

// Section metadata registry for known curriculum sections
const KNOWN_SECTIONS = {
  see_things: {
    title: 'How We See Things',
    lo_id: 'SCI6-CH10-S01-LO01',
    lo_title: 'Rectilinear Propagation & Reflection',
    icon: 'eye'
  },
  materials: {
    title: 'Materials: Transparent, Translucent & Opaque',
    lo_id: 'SCI6-CH10-S02-LO02',
    lo_title: 'Material Transmission Properties',
    icon: 'box'
  },
  shadows: {
    title: 'Formation of Shadows & Ray Geometry',
    lo_id: 'SCI6-CH10-S03-LO03',
    lo_title: 'Shadow Formation & Ray Angle Prediction',
    icon: 'monitor-up'
  },
  eclipse: {
    title: 'Eclipses & Astronomical Shadows',
    lo_id: 'SCI6-CH10-S04-LO04',
    lo_title: 'Solar & Lunar Eclipse Dynamics',
    icon: 'moon'
  }
};

/**
 * Robust RFC-4180 compliant CSV parser with support for quoted strings,
 * escaped quotes (""), embedded newlines, and carriage returns.
 * 
 * @param {string} csvText - Raw CSV text
 * @returns {Array<Object>} Array of row objects with normalized header keys
 */
export function parseCSV(csvText) {
  if (!csvText || typeof csvText !== 'string') return [];

  const cleanText = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;

  while (i < cleanText.length) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i += 2;
        continue;
      } else if (char === '"') {
        inQuotes = false;
        i++;
        continue;
      } else {
        currentField += char;
        i++;
        continue;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
        continue;
      } else if (char === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
        i++;
        continue;
      } else if (char === '\n') {
        currentRow.push(currentField.trim());
        if (currentRow.some(field => field.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
        i++;
        continue;
      } else {
        currentField += char;
        i++;
        continue;
      }
    }
  }

  // Push final field/row if remaining
  if (currentField.length > 0 || inQuotes || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(field => field.length > 0)) {
      rows.push(currentRow);
    }
  }

  if (rows.length < 2) return [];

  // Normalize headers: lowercase, trim, replace spaces/dashes with underscores
  const rawHeaders = rows[0];
  const headers = rawHeaders.map(h =>
    h.toLowerCase().trim().replace(/[\s-]+/g, '_').replace(/[^a-z0-9_]/g, '')
  );

  const parsedObjects = [];
  for (let r = 1; r < rows.length; r++) {
    const rowValues = rows[r];
    const rowObj = {};
    headers.forEach((header, idx) => {
      rowObj[header] = rowValues[idx] !== undefined ? rowValues[idx] : '';
    });
    parsedObjects.push(rowObj);
  }

  return parsedObjects;
}

/**
 * Normalizes correct_option into a 0-based index (0, 1, 2, 3).
 * Accepts 'A', 'B', 'C', 'D' (case-insensitive) or '0', '1', '2', '3', or numbers 0-3.
 * 
 * @param {string|number} val 
 * @returns {number|null} 0-3 index or null if invalid
 */
export function normalizeCorrectOption(val) {
  if (val === null || val === undefined) return null;
  const str = String(val).trim().toUpperCase();

  if (str === 'A' || str === '0') return 0;
  if (str === 'B' || str === '1') return 1;
  if (str === 'C' || str === '2') return 2;
  if (str === 'D' || str === '3') return 3;

  return null;
}

/**
 * Validates a single row from a Google Sheet against the EdTech Island quiz schema.
 * 
 * @param {Object} row - Parsed row object
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateQuizSheetRow(row) {
  const errors = [];

  if (!row || typeof row !== 'object') {
    return { valid: false, errors: ['Row must be a non-null object'] };
  }

  // 1. Required columns presence and non-empty check
  for (const col of REQUIRED_COLUMNS) {
    const val = row[col];
    if (val === undefined || val === null || String(val).trim() === '') {
      errors.push(`Missing required column: "${col}"`);
    }
  }

  // 2. Correct option check (A/B/C/D or 0-3)
  if (row.correct_option !== undefined && row.correct_option !== null && String(row.correct_option).trim() !== '') {
    const normCorrect = normalizeCorrectOption(row.correct_option);
    if (normCorrect === null) {
      errors.push(`Invalid correct_option "${row.correct_option}". Expected A, B, C, D or 0, 1, 2, 3`);
    }
  }

  // 3. Bloom level check (if provided, must be valid)
  if (row.bloom_level && String(row.bloom_level).trim() !== '') {
    const bloom = String(row.bloom_level).toLowerCase().trim();
    if (!VALID_BLOOM_LEVELS.includes(bloom)) {
      errors.push(`Invalid bloom_level "${row.bloom_level}". Allowed: ${VALID_BLOOM_LEVELS.join(', ')}`);
    }
  }

  // 4. Difficulty check (if provided, must be valid)
  if (row.difficulty && String(row.difficulty).trim() !== '') {
    const diff = String(row.difficulty).toLowerCase().trim();
    if (!VALID_DIFFICULTIES.includes(diff)) {
      errors.push(`Invalid difficulty "${row.difficulty}". Allowed: ${VALID_DIFFICULTIES.join(', ')}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Parses raw data (CSV string or array of row objects) into the standardized
 * EdTech Island Quiz schema.
 * 
 * @param {string|Array<Object>} rawData 
 * @param {Object} [meta={}] Optional chapter metadata overrides
 * @returns {{ chapter_id: string, chapter_title: string, sections: Array<Object>, total_questions: number }}
 */
export function parseQuizSheetData(rawData, meta = {}) {
  let rows = [];

  if (typeof rawData === 'string') {
    rows = parseCSV(rawData);
  } else if (Array.isArray(rawData)) {
    rows = rawData;
  } else {
    throw new Error('parseQuizSheetData: Expected CSV string or array of row objects.');
  }

  if (rows.length === 0) {
    throw new Error('parseQuizSheetData: No question rows found in sheet data.');
  }

  const sectionsMap = new Map();
  const validationWarnings = [];
  let validQuestionCount = 0;

  rows.forEach((row, idx) => {
    const validation = validateQuizSheetRow(row);
    if (!validation.valid) {
      validationWarnings.push(`Row ${idx + 2} (${row.question_id || 'unknown'}): ${validation.errors.join('; ')}`);
      return; // Skip invalid row
    }

    const sectionId = String(row.section_id || 'general').toLowerCase().trim();
    const correctIdx = normalizeCorrectOption(row.correct_option);

    const question = {
      id: String(row.question_id).trim(),
      section_id: sectionId,
      text: String(row.text).trim(),
      options: [
        String(row.option_a || '').trim(),
        String(row.option_b || '').trim(),
        String(row.option_c || '').trim(),
        String(row.option_d || '').trim()
      ],
      correct: correctIdx,
      bloom_level: (row.bloom_level ? String(row.bloom_level).toLowerCase().trim() : 'understand'),
      difficulty: (row.difficulty ? String(row.difficulty).toLowerCase().trim() : 'medium'),
      lo_id: String(row.lo_id || (KNOWN_SECTIONS[sectionId]?.lo_id) || 'LO-GENERAL').trim(),
      lo_title: String(row.lo_title || (KNOWN_SECTIONS[sectionId]?.lo_title) || 'General Science').trim(),
      hint: String(row.hint || '').trim(),
      explanation: String(row.explanation || '').trim(),
      icon: String(row.icon || (KNOWN_SECTIONS[sectionId]?.icon) || 'help-circle').trim()
    };

    if (!sectionsMap.has(sectionId)) {
      const known = KNOWN_SECTIONS[sectionId] || {};
      sectionsMap.set(sectionId, {
        id: sectionId,
        title: known.title || formatTitleCase(sectionId),
        lo_id: question.lo_id,
        lo_title: question.lo_title,
        icon: known.icon || 'book-open',
        questions: []
      });
    }

    sectionsMap.get(sectionId).questions.push(question);
    validQuestionCount++;
  });

  if (validationWarnings.length > 0) {
    console.warn(`[SheetsQuizSync] ${validationWarnings.length} invalid rows skipped:`, validationWarnings);
  }

  if (validQuestionCount === 0) {
    throw new Error('parseQuizSheetData: All rows failed validation.');
  }

  const sections = Array.from(sectionsMap.values());

  return {
    chapter_id: meta.chapter_id || defaultQuizData.chapter_id || 'SCI6-CH10',
    chapter_title: meta.chapter_title || defaultQuizData.chapter_title || 'Chapter 10: Light, Shadows and Optics',
    grade: meta.grade || defaultQuizData.grade || 6,
    subject: meta.subject || defaultQuizData.subject || 'Science',
    sections,
    total_questions: validQuestionCount,
    source: 'google_sheets'
  };
}

/**
 * Fetches published Google Sheet CSV from public URL.
 * Automatically falls back to local sample_chapter_quiz.json if offline,
 * URL is missing, network error, or invalid data.
 * 
 * @param {string|null} sheetUrl - Published Google Sheet CSV URL
 * @param {Object} [fallbackData=defaultQuizData] - Local JSON fallback
 * @returns {Promise<Object>} Standardized quiz schema object
 */
export async function fetchQuizFromGoogleSheet(sheetUrl, fallbackData = defaultQuizData, meta = {}) {
  if (!sheetUrl || typeof sheetUrl !== 'string' || sheetUrl.trim() === '') {
    return fallbackData;
  }

  const trimmedUrl = sheetUrl.trim();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000);

    const res = await fetch(trimmedUrl, {
      signal: controller.signal,
      cache: 'no-cache'
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`HTTP Error: ${res.status} ${res.statusText}`);
    }

    const csvText = await res.text();
    if (!csvText || csvText.trim() === '') {
      throw new Error('Empty CSV response returned from sheet URL');
    }

    const isGoogle = trimmedUrl.includes('google.com') || trimmedUrl.includes('spreadsheets');
    const parsed = parseQuizSheetData(csvText, {
      ...meta,
      source: isGoogle ? 'google_sheets' : 'csv'
    });
    console.log(`[SheetsQuizSync] Successfully loaded ${parsed.total_questions} questions across ${parsed.sections.length} sections from ${parsed.source}.`);
    return parsed;
  } catch (err) {
    console.warn(`[SheetsQuizSync] Failed to fetch/parse from quiz URL (${err.message}). Falling back to local curriculum quiz data.`);
    return fallbackData;
  }
}

function formatTitleCase(str) {
  return str
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
