const fs = require('fs');
const path = require('path');

const jsonPath = path.join(__dirname, '..', 'study-island', 'src', 'data', 'sample_chapter_quiz.json');
const rawData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

const headers = [
  'question_id',
  'section_id',
  'text',
  'option_a',
  'option_b',
  'option_c',
  'option_d',
  'correct_option',
  'bloom_level',
  'difficulty',
  'lo_id',
  'lo_title',
  'hint',
  'explanation',
  'icon'
];

function escapeCsvField(val) {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const optionMap = ['A', 'B', 'C', 'D'];
const csvRows = [headers.join(',')];

let totalQuestions = 0;

rawData.sections.forEach(sec => {
  const secId = sec.id;
  const secLoId = sec.lo_id || '';
  const secLoTitle = sec.lo_title || '';
  const secIcon = sec.icon || 'book-open';

  sec.questions.forEach(q => {
    totalQuestions++;
    const correctLetter = optionMap[q.correct] || 'A';
    const row = [
      escapeCsvField(q.id),
      escapeCsvField(secId),
      escapeCsvField(q.text),
      escapeCsvField(q.options[0] || ''),
      escapeCsvField(q.options[1] || ''),
      escapeCsvField(q.options[2] || ''),
      escapeCsvField(q.options[3] || ''),
      escapeCsvField(correctLetter),
      escapeCsvField(q.bloom_level || 'understand'),
      escapeCsvField(q.difficulty || 'medium'),
      escapeCsvField(q.lo_id || secLoId),
      escapeCsvField(q.lo_title || secLoTitle),
      escapeCsvField(q.hint || ''),
      escapeCsvField(q.explanation || ''),
      escapeCsvField(q.icon || secIcon)
    ];
    csvRows.push(row.join(','));
  });
});

const csvContent = csvRows.join('\r\n') + '\r\n';

// Write to ROOT/data/light_and_shadows_quiz.csv
const rootDataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(rootDataDir)) {
  fs.mkdirSync(rootDataDir, { recursive: true });
}
const rootCsvPath = path.join(rootDataDir, 'light_and_shadows_quiz.csv');
fs.writeFileSync(rootCsvPath, csvContent, 'utf8');

// Write to study-island/public/data/light_and_shadows_quiz.csv
const studyIslandDataDir = path.join(__dirname, '..', 'study-island', 'public', 'data');
if (!fs.existsSync(studyIslandDataDir)) {
  fs.mkdirSync(studyIslandDataDir, { recursive: true });
}
const studyIslandCsvPath = path.join(studyIslandDataDir, 'light_and_shadows_quiz.csv');
fs.writeFileSync(studyIslandCsvPath, csvContent, 'utf8');

console.log(`Successfully generated CSV with ${totalQuestions} questions:`);
console.log(`- ${rootCsvPath}`);
console.log(`- ${studyIslandCsvPath}`);
