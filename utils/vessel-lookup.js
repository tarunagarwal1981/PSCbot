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
          .map(v => ({ name: String(v.name), imo: String(v.imo) }));
        return vesselCache;
      }
    } catch (err) {
      console.warn('Warning: failed to parse VESSEL_MAPPINGS_JSON env var:', err);
    }
  }

  // 2) Try CSV from repo
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
      const name = parts[0];
      const imo = parts[1];
      if (name && imo) {
        vessels.push({ name, imo });
      }
    }
  }

  vesselCache = vessels;
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

