// Parse /app/moonlight/docs/v2/100-indicators.md into two JSON files:
//   - indicators.json (100 core indicators)
//   - templates.json  (100 multi-use templates)
// Usage: node scripts/parse-indicators.js

const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(
  path.join(__dirname, '..', '..', 'docs', 'v2', '100-indicators.md'),
  'utf8',
);

const lines = src.split(/\r?\n/);

function parseTable(startIdx) {
  const rows = [];
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('|')) continue;
    // Skip separator lines like |---|---|
    if (/^\|[\s:\-|]+\|$/.test(line)) continue;
    const cells = line
      .split('|')
      .map((s) => s.trim())
      .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
    if (cells.length === 0) continue;
    // Stop at next section (blank row after table)
    if (cells[0] === '' || cells[0].startsWith('#')) continue;
    rows.push(cells);
    // Break when line after is blank or non-table (naive)
    if (i + 1 < lines.length) {
      const next = lines[i + 1].trim();
      if (!next.startsWith('|') && next.length > 0) break;
    }
  }
  return rows;
}

// Collect every table row in document
const allRows = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line.startsWith('|')) continue;
  if (/^\|[\s:\-|]+\|$/.test(line)) continue;
  const cells = line.split('|').map((s) => s.trim());
  // normalize: first and last are empty
  const clean = cells.slice(1, -1).map((s) => s.trim());
  allRows.push(clean);
}

// Header of first table contains "Gösterge" in col 1
// Header of second table contains "Şablon" in col 1
const indicators = [];
const templates = [];
let section = null;
for (const row of allRows) {
  if (row.length === 0) continue;
  const first = row[0];
  const second = row[1] || '';
  // Detect header rows
  if (first === '#' && /gösterge/i.test(second)) {
    section = 'indicators';
    continue;
  }
  if (first === '#' && /şablon/i.test(second)) {
    section = 'templates';
    continue;
  }
  if (section === null) continue;
  // Data row starts with numeric
  if (!/^\d+$/.test(first)) continue;
  const n = parseInt(first, 10);
  if (section === 'indicators' && row.length >= 9) {
    indicators.push({
      n,
      name: row[1],
      family: row[2],
      measures: row[3],
      defaultParams: row[4],
      suitableTf: row[5],
      longRead: row[6],
      shortRead: row[7],
      bestMatch: row[8],
    });
  } else if (section === 'templates' && row.length >= 7) {
    templates.push({
      n,
      name: row[1],
      purpose: row[2],
      components: row[3],
      suitableTf: row[4],
      longRule: row[5],
      shortRule: row[6],
    });
  }
}

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}

const indicatorRegistry = indicators.map((i) => ({
  id: `ind_${i.n.toString().padStart(3, '0')}_${slugify(i.name)}`,
  n: i.n,
  name: i.name,
  family: i.family,
  measures: i.measures,
  defaultParams: i.defaultParams,
  suitableTimeframes: i.suitableTf,
  longReading: i.longRead,
  shortReading: i.shortRead,
  bestMatch: i.bestMatch,
  implemented: false, // marked true when real math lives in indicator-library
}));

const templateRegistry = templates.map((t) => ({
  id: `tpl_${t.n.toString().padStart(3, '0')}_${slugify(t.name)}`,
  n: t.n,
  name: t.name,
  purpose: t.purpose,
  components: t.components,
  suitableTimeframes: t.suitableTf,
  longRule: t.longRule,
  shortRule: t.shortRule,
  implemented: false,
}));

const outDir = path.join(__dirname, '..', 'src', 'indicators', 'templates');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, 'indicators.json'),
  JSON.stringify(indicatorRegistry, null, 2),
);
fs.writeFileSync(
  path.join(outDir, 'templates.json'),
  JSON.stringify(templateRegistry, null, 2),
);

console.log(
  `Wrote ${indicatorRegistry.length} indicators + ${templateRegistry.length} templates to ${outDir}`,
);
