const fs = require('fs');
const path = require('path');

// Import the parser directly (transpiling not needed if we test the parsing function logic)
const csvPath = path.join(__dirname, '..', 'data', 'light_and_shadows_quiz.csv');
const csvText = fs.readFileSync(csvPath, 'utf8');

function parseCSV(csvText) {
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

  if (currentField.length > 0 || inQuotes || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(field => field.length > 0)) {
      rows.push(currentRow);
    }
  }

  if (rows.length < 2) return [];

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

const rows = parseCSV(csvText);
console.log(`Parsed ${rows.length} question rows from CSV.`);

const REQUIRED_COLUMNS = [
  'question_id',
  'section_id',
  'text',
  'option_a',
  'option_b',
  'option_c',
  'option_d',
  'correct_option'
];

let errors = 0;
rows.forEach((r, idx) => {
  for (const col of REQUIRED_COLUMNS) {
    if (!r[col] || r[col].trim() === '') {
      console.error(`Row ${idx + 2} missing column ${col}`);
      errors++;
    }
  }
  if (!['A', 'B', 'C', 'D', '0', '1', '2', '3'].includes(r.correct_option.trim().toUpperCase())) {
    console.error(`Row ${idx + 2} invalid correct_option: ${r.correct_option}`);
    errors++;
  }
});

console.log(`Validation finished. Total errors: ${errors}`);
if (errors === 0) {
  console.log('✅ ALL CSV ROWS VALIDATED SUCCESSFULLY!');
}
