const fetch = require('node-fetch');
// node-fetch v2 doesn't export AbortController; use the standalone polyfill
const AbortController = require('abort-controller');
const { getVesselByName, getVesselByIMO } = require('./vessel-lookup');

// API Endpoints (allow override via env)
const DASHBOARD_API = process.env.DASHBOARD_API_URL || 'https://psc.ocean-eye.io/api/v1/vessels/dashboard/';
const RECOMMENDATIONS_API =
  process.env.RECOMMENDATIONS_API_URL ||
  'https://psc.ocean-eye.io/api/v1/vessels/{IMO}/amsa/recommendations';

// Cache configuration
const CACHE_DURATION_MS = 3600000; // 1 hour
const RECOMMENDATIONS_TIMEOUT_MS = 8000; // 8s timeout to avoid webhook overrun

// In-memory cache for dashboard data
/** @type {{ data: any, timestamp: number } | null} */
let dashboardCache = null;

/**
 * Fetch all vessels from dashboard API
 * Caches results for 1 hour
 * @returns {Promise<any>} Dashboard data or null on error
 */
async function fetchDashboardData() {
  // Check cache first
  if (dashboardCache !== null) {
    const now = Date.now();
    const cacheAge = now - dashboardCache.timestamp;
    
    if (cacheAge < CACHE_DURATION_MS) {
      console.log(`Using cached dashboard data (age: ${Math.round(cacheAge / 1000)}s)`);
      return dashboardCache.data;
    } else {
      console.log('Cache expired, fetching fresh dashboard data');
      dashboardCache = null;
    }
  }

  try {
    console.log('Fetching dashboard data from API...');
    const response = await fetch(DASHBOARD_API, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Dashboard API returned status ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Update cache
    dashboardCache = {
      data,
      timestamp: Date.now(),
    };

    console.log('Dashboard data fetched and cached successfully');
    return data;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error fetching dashboard data:', errorMessage);
    return null;
  }
}

/**
 * Fetch vessel data by name
 * Uses dashboard data and vessel-lookup for name resolution
 * @param {string} vesselName - Name of the vessel to fetch
 * @returns {Promise<any>} Vessel data or null if not found
 */
async function fetchVesselByName(vesselName) {
  if (!vesselName || typeof vesselName !== 'string') {
    console.error('Invalid vessel name provided');
    return null;
  }

  try {
    // First, try to resolve vessel name to IMO using vessel-lookup
    const vesselLookup = getVesselByName(vesselName);
    
    if (!vesselLookup) {
      console.log(`Vessel "${vesselName}" not found in vessel mappings`);
      return null;
    }

    // Fetch dashboard data (uses cache if available)
    const dashboardData = await fetchDashboardData();
    
    if (!dashboardData) {
      console.error('Failed to fetch dashboard data');
      return null;
    }

    // Search for vessel in dashboard data
    // Dashboard API might return vessels in different formats
    // Try to find by IMO first, then by name
    const imo = vesselLookup.imo;
    const name = vesselLookup.name;

    // Check if dashboard data is an array
    if (Array.isArray(dashboardData)) {
      // Search by IMO
      let vessel = dashboardData.find(v => 
        v.imo === imo || 
        v.imoNumber === imo || 
        String(v.imo) === String(imo)
      );

      // If not found by IMO, try by name
      if (!vessel) {
        vessel = dashboardData.find(v => {
          const vName = v.name || v.vesselName || v.vessel_name || '';
          return vName.toUpperCase() === name.toUpperCase();
        });
      }

      if (vessel) {
        console.log(`Found vessel "${vesselName}" in dashboard data`);
        return vessel;
      }
    } else if (dashboardData && typeof dashboardData === 'object') {
      // Dashboard might return an object with vessels array
      const vessels = dashboardData.vessels || dashboardData.data || [];
      
      if (Array.isArray(vessels)) {
        let vessel = vessels.find(v => 
          v.imo === imo || 
          v.imoNumber === imo || 
          String(v.imo) === String(imo)
        );

        if (!vessel) {
          vessel = vessels.find(v => {
            const vName = v.name || v.vesselName || v.vessel_name || '';
            return vName.toUpperCase() === name.toUpperCase();
          });
        }

        if (vessel) {
          console.log(`Found vessel "${vesselName}" in dashboard data`);
          return vessel;
        }
      }
    }

    console.log(`Vessel "${vesselName}" not found in dashboard data`);
    return null;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error fetching vessel by name "${vesselName}":`, errorMessage);
    return null;
  }
}

/**
 * Fetch recommendations for a specific IMO
 * @param {string|number} imo - IMO number of the vessel
 * @returns {Promise<any>} Recommendations data or null on error
 */
async function fetchRecommendations(imo) {
  if (!imo) {
    console.error('Invalid IMO provided');
    return null;
  }

  const imoStr = String(imo).trim();
  if (!imoStr) {
    console.error('IMO cannot be empty');
    return null;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), RECOMMENDATIONS_TIMEOUT_MS);

    // Replace {IMO} placeholder in URL
    const url = RECOMMENDATIONS_API.replace('{IMO}', imoStr);
    
    console.log(`Fetching recommendations for IMO ${imoStr}...`);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`No recommendations found for IMO ${imoStr}`);
        return null;
      }
      throw new Error(`Recommendations API returned status ${response.status}: ${response.statusText}`);
    }

    const raw = await response.text();
    try {
      // Some responses contain leading commented lines (starting with '#')
      const cleaned = raw.replace(/^#[^\n]*\n/gm, '').trim();
      const data = JSON.parse(cleaned);
      console.log(`Recommendations fetched successfully for IMO ${imoStr}`);
      return data;
    } catch (parseErr) {
      console.error(`Error parsing recommendations JSON for IMO ${imoStr}: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`);
      console.error('Response preview:', raw.substring(0, 200));
      return null;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error fetching recommendations for IMO ${imoStr}:`, errorMessage);
    return null;
  }
}

/**
 * Clear the dashboard data cache
 * Useful for testing or forcing a fresh fetch
 */
function clearCache() {
  dashboardCache = null;
  console.log('Dashboard cache cleared');
}

module.exports = {
  fetchDashboardData,
  fetchVesselByName,
  fetchRecommendations,
  clearCache,
  // Export constants for testing/debugging
  DASHBOARD_API,
  RECOMMENDATIONS_API,
  CACHE_DURATION_MS,
};

