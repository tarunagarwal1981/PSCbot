const fs = require('fs');
const path = require('path');

// Cache for loaded vessel data
/** @type {Array<{name: string, imo: string}> | null} */
let vesselCache = null;

// Built-in fallback mappings so Netlify bundle works even without CSV
// Keep this small; extend with env var VESSEL_MAPPINGS_JSON if needed.
const DEFAULT_VESSELS = [
  { name: 'GCL YAMUNA', imo: '9481219' },
  { name: 'GCL TAPI', imo: '9481659' },
  { name: 'GCL GANGA', imo: '9481697' },
  { name: 'GCL SABARMATI', imo: '9481661' },
];

/**
 * Load and parse the vessel mappings CSV file
 * @returns {Array<{name: string, imo: string}>}
 */
function loadVesselMappings() {
  if (vesselCache !== null) {
    return vesselCache;
  }

  // 1) Allow override via env var JSON to avoid packaging issues
  const envJson = process.env.VESSEL_MAPPINGS_JSON;
  if (envJson) {
    try {
      const parsed = JSON.parse(envJson);
      if (Array.isArray(parsed)) {
        vesselCache = parsed
          .filter(v => v && v.name && v.imo)
          .map(v => ({
            name: String(v.name).trim(),
            imo: String(v.imo).trim(),
          }));
        console.log('Vessel mappings loaded from env JSON');
        return vesselCache;
      }
    } catch (err) {
      console.warn('Warning: failed to parse VESSEL_MAPPINGS_JSON env var:', err);
    }
  }

  // 2) Try JSON file (more reliable bundling than CSV)
  const jsonPath = path.join(__dirname, '..', 'data', 'vessel-mappings.json');
  if (fs.existsSync(jsonPath)) {
    try {
      const jsonContent = fs.readFileSync(jsonPath, 'utf8');
      const parsed = JSON.parse(jsonContent);
      if (Array.isArray(parsed)) {
        vesselCache = parsed
          .filter(v => v && v.name && v.imo)
          .map(v => ({
            name: String(v.name).trim(),
            imo: String(v.imo).trim(),
          }));
        console.log('Vessel mappings loaded from vessel-mappings.json');
        return vesselCache;
      }
    } catch (err) {
      console.warn('Warning: failed to load vessel-mappings.json:', err);
    }
  }

  // 3) Try CSV from repo
  const csvPath = path.join(__dirname, '..', 'data', 'vessel-mappings.csv');
  
  if (!fs.existsSync(csvPath)) {
    console.warn(`Warning: Vessel mappings file not found at ${csvPath}, using default list`);
    vesselCache = DEFAULT_VESSELS;
    return vesselCache;
  }

  const csvContent = fs.readFileSync(csvPath, 'utf8');
  const lines = csvContent.split('\n').filter(line => line.trim() !== '');
  
  // Skip header row
  const vessels = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (!line) continue;
    if (!line) continue;
    
    // Parse CSV line (handles quoted values)
    const parts = line.split(',').map(part => part.trim().replace(/^"|"$/g, ''));
    if (parts.length >= 2) {
      const name = parts[0].trim();
      const imo = parts[1].trim();
      if (name && imo) {
        vessels.push({ name, imo });
      }
    }
  }

  vesselCache = vessels;
  console.log('Vessel mappings loaded from vessel-mappings.csv');
  return vessels;
}

/**
 * Get vessel by name (case-insensitive, supports partial matches)
 * @param {string} name - Vessel name to search for
 * @returns {{name: string, imo: string} | null}
 */
function getVesselByName(name) {
  if (!name || typeof name !== 'string') {
    return null;
  }

  const vessels = loadVesselMappings();
  const searchName = name.trim().toUpperCase();
  
  if (!searchName) {
    return null;
  }

  // First try exact match (case-insensitive)
  for (const vessel of vessels) {
    if (vessel.name.toUpperCase() === searchName) {
      return { name: vessel.name, imo: vessel.imo };
    }
  }

  // Then try partial match
  for (const vessel of vessels) {
    const vesselNameUpper = vessel.name.toUpperCase();
    if (vesselNameUpper.includes(searchName) || searchName.includes(vesselNameUpper)) {
      return { name: vessel.name, imo: vessel.imo };
    }
  }

  // Finally, fuzzy match (Levenshtein distance) to handle minor typos
  const distance = (a, b) => {
    const m = a.length;
    const n = b.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,     // deletion
          dp[i][j - 1] + 1,     // insertion
          dp[i - 1][j - 1] + cost // substitution
        );
      }
    }
    return dp[m][n];
  };

  let best = null;
  let bestDist = Infinity;
  for (const vessel of vessels) {
    const d = distance(searchName, vessel.name.toUpperCase());
    if (d < bestDist) {
      bestDist = d;
      best = vessel;
    }
  }

  // Accept near-miss matches with small edit distance
  if (best && bestDist <= 2) {
    return { name: best.name, imo: best.imo };
  }

  return null;
}

/**
 * Get vessel by IMO number
 * @param {string|number} imo - IMO number to search for
 * @returns {{name: string, imo: string} | null}
 */
function getVesselByIMO(imo) {
  if (!imo) {
    return null;
  }

  const imoStr = String(imo).trim();
  if (!imoStr) {
    return null;
  }

  const vessels = loadVesselMappings();
  
  for (const vessel of vessels) {
    if (vessel.imo === imoStr) {
      return { name: vessel.name, imo: vessel.imo };
    }
  }

  return null;
}

/**
 * Clear the vessel cache (useful for testing or reloading data)
 */
function clearCache() {
  vesselCache = null;
}

module.exports = {
  loadVesselMappings,
  getVesselByName,
  getVesselByIMO,
  clearCache,
};

