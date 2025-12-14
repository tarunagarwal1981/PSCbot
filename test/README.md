# Test Scripts

This directory contains test scripts for various components of the PSC Bot.

## Test Scripts

### `test-vessel-lookup.js`
Tests the vessel lookup functionality:
- Exact name matches
- Partial matches
- Case insensitivity
- IMO number lookups
- Invalid input handling
- Cache functionality

**Usage:**
```bash
node test/test-vessel-lookup.js
```

### `test-excel-generation.js`
Tests Excel file generation:
- Generates Excel file with sample vessel data
- Verifies file creation
- Validates file format
- Saves output to `test/output/test-recommendations.xlsx`

**Usage:**
```bash
node test/test-excel-generation.js
```

**Output:**
- Creates `test/output/` directory if it doesn't exist
- Generates `test-recommendations.xlsx` file
- Provides instructions to open the file for manual inspection

### `test-api-client.js`
Tests the API client functionality:
- `fetchDashboardData` (with caching)
- `fetchVesselByName`
- `fetchRecommendations`
- Cache behavior verification
- Error handling

**Usage:**
```bash
# With real API (requires VESSEL_API_URL)
VESSEL_API_URL=https://api.example.com node test/test-api-client.js

# Without real API (uses sample data)
node test/test-api-client.js
```

**Note:** If `VESSEL_API_URL` is not set, tests will use sample data from `sample-data.json`.

## Sample Data

### `sample-data.json`
Contains sample data for testing without hitting real APIs:
- Sample vessel object with all required fields
- Sample recommendations object with CRITICAL, MODERATE, and RECOMMENDED items
- Sample dashboard data structure

This file is used by test scripts when real API endpoints are not available or for offline testing.

## Running All Tests

You can run all tests sequentially:

```bash
# Test vessel lookup
node test/test-vessel-lookup.js

# Test Excel generation
node test/test-excel-generation.js

# Test API client (with or without real API)
node test/test-api-client.js
```

## Test Output

All test scripts provide:
- ✅ Clear success/failure indicators
- 📊 Summary of passed/failed tests
- 💡 Helpful tips and instructions
- 🎨 Color-coded output for better readability

## Requirements

- Node.js (v14 or higher)
- All dependencies from `package.json` installed (`npm install`)
- For API tests: `VESSEL_API_URL` environment variable (optional)

## Output Directory

Excel generation tests create files in `test/output/` directory. This directory is automatically created if it doesn't exist.

