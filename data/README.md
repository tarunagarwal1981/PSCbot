# Vessel Mappings Data

This directory contains vessel name-to-IMO number mappings used for vessel lookup functionality.

## File: `vessel-mappings.csv`

This CSV file maps vessel names to their IMO (International Maritime Organization) numbers, enabling the bot to resolve vessel names to IMO numbers for API queries.

### CSV Format

The file uses a simple CSV format with the following structure:

```csv
# Vessel Name to IMO Mapping
# Add your full fleet below (600+ vessels)
# Format: vessel_name,imo
# Names are case-insensitive for matching

vessel_name,imo
GCL YAMUNA,9481219
GCL TAPI,9481659
GCL GANGA,9481697
GCL SABARMATI,9481661
```

**Format Rules:**
- First line: Header row (`vessel_name,imo`)
- Each subsequent line: `vessel_name,imo` (comma-separated)
- No spaces around commas
- Vessel names can contain spaces, hyphens, and special characters
- IMO numbers are numeric (7 digits typically)
- Comments (lines starting with `#`) are supported

### How to Add Vessels

1. **Open the file:**
   ```bash
   nano data/vessel-mappings.csv
   # or use your preferred editor
   ```

2. **Add vessels at the end of the file** (before any comments):
   ```csv
   YOUR VESSEL NAME,1234567
   ANOTHER VESSEL,7654321
   ```

3. **Save the file**

4. **Test the lookup:**
   ```bash
   node test/test-vessel-lookup.js
   ```

**Important Notes:**
- Vessel names are case-insensitive (e.g., "GCL YAMUNA" matches "gcl yamuna")
- Each vessel should be on a separate line
- IMO numbers must be unique
- No duplicate vessel names (use the most common name)

### Bulk Import (600+ Vessels)

To add your full fleet:

1. **Prepare your CSV file** with format:
   ```csv
   vessel_name,imo
   VESSEL 1,1234567
   VESSEL 2,2345678
   ...
   ```

2. **Replace the content:**
   ```bash
   # Backup existing file
   cp data/vessel-mappings.csv data/vessel-mappings.csv.backup
   
   # Replace with your file
   cp your-fleet.csv data/vessel-mappings.csv
   ```

3. **Verify format:**
   ```bash
   # Check first few lines
   head -5 data/vessel-mappings.csv
   
   # Count vessels (should be 600+)
   wc -l data/vessel-mappings.csv
   ```

4. **Test lookup:**
   ```bash
   node test/test-vessel-lookup.js
   ```

### How Partial Matching Works

The vessel lookup system supports flexible matching:

1. **Exact Match (Case-Insensitive):**
   - Input: `GCL YAMUNA` or `gcl yamuna` or `Gcl Yamuna`
   - Finds: `GCL YAMUNA`

2. **Partial Match:**
   - Input: `YAMUNA`
   - Finds: `GCL YAMUNA` (if "YAMUNA" is contained in the vessel name)
   
   - Input: `GCL`
   - Finds: First vessel starting with "GCL" (e.g., `GCL YAMUNA`)

3. **Substring Match:**
   - The system checks if the search term is contained in the vessel name
   - Or if the vessel name is contained in the search term
   - Example: `YAMUNA` matches `GCL YAMUNA`

**Matching Priority:**
1. Exact match (case-insensitive) - highest priority
2. Partial match - if exact match not found

**Note:** Partial matching returns the first match found. For best results, use full vessel names or unique identifiers.

### How to Test Lookup

#### Test Individual Vessel Lookup

```bash
# Test vessel lookup module
node test/test-vessel-lookup.js
```

This will test:
- Exact name matches
- Case insensitivity
- Partial matches
- IMO number lookups
- Invalid input handling

#### Test via Node.js REPL

```bash
node
```

```javascript
const vesselLookup = require('./utils/vessel-lookup');

// Test exact match
vesselLookup.getVesselByName('GCL YAMUNA');
// Returns: { name: 'GCL YAMUNA', imo: '9481219' }

// Test case insensitivity
vesselLookup.getVesselByName('gcl yamuna');
// Returns: { name: 'GCL YAMUNA', imo: '9481219' }

// Test partial match
vesselLookup.getVesselByName('YAMUNA');
// Returns: { name: 'GCL YAMUNA', imo: '9481219' }

// Test IMO lookup
vesselLookup.getVesselByIMO('9481219');
// Returns: { name: 'GCL YAMUNA', imo: '9481219' }

// Test non-existent vessel
vesselLookup.getVesselByName('NONEXISTENT');
// Returns: null
```

#### Test via WhatsApp Bot

Once deployed, test via WhatsApp:

```
Risk score for GCL YAMUNA
```

```
YAMUNA risk level
```

```
Recommendations for 9481219
```

### File Location

The vessel mappings file is located at:
```
data/vessel-mappings.csv
```

This file is:
- ✅ Included in version control
- ✅ Loaded at runtime by the vessel-lookup module
- ✅ Cached in memory for performance
- ✅ Automatically reloaded when cache is cleared

### Cache Management

The vessel lookup module caches the CSV data in memory. To force a reload:

```javascript
const vesselLookup = require('./utils/vessel-lookup');

// Clear cache and reload
vesselLookup.clearCache();

// Next lookup will reload from file
vesselLookup.getVesselByName('GCL YAMUNA');
```

### Troubleshooting

**Issue: Vessel not found**

1. **Check vessel name spelling:**
   - Verify exact name in CSV file
   - Check for extra spaces or special characters

2. **Check CSV format:**
   - Ensure format is `vessel_name,imo` (comma-separated)
   - No spaces around commas
   - No quotes unless necessary

3. **Clear cache:**
   ```javascript
   vesselLookup.clearCache();
   ```

4. **Verify file exists:**
   ```bash
   ls -la data/vessel-mappings.csv
   cat data/vessel-mappings.csv | head -5
   ```

**Issue: Partial match returns wrong vessel**

- Use more specific search terms
- Consider using IMO numbers for exact matching
- Ensure vessel names are unique enough

**Issue: CSV parsing errors**

- Check for special characters in vessel names
- Ensure IMO numbers are numeric only
- Verify no empty lines between entries
- Check file encoding (should be UTF-8)

### Best Practices

1. **Use consistent naming:**
   - Use the most common/official vessel name
   - Avoid abbreviations unless widely used

2. **Keep IMO numbers accurate:**
   - Verify IMO numbers are correct
   - IMO numbers are 7 digits (with leading zeros if needed)

3. **Regular updates:**
   - Update CSV when vessels are added/removed
   - Keep in sync with your vessel database

4. **Backup:**
   - Keep backups of your vessel mappings
   - Version control helps track changes

### Example: Adding 600+ Vessels

```bash
# 1. Export from your database/system
# Format: vessel_name,imo
# Save as: my-fleet.csv

# 2. Verify format
head -5 my-fleet.csv
# Should show:
# vessel_name,imo
# VESSEL 1,1234567
# VESSEL 2,2345678
# ...

# 3. Replace existing file
cp my-fleet.csv data/vessel-mappings.csv

# 4. Verify count
wc -l data/vessel-mappings.csv
# Should show 600+ lines (including header)

# 5. Test
node test/test-vessel-lookup.js
```

---

**Note:** This file is where Tarun will paste his 600-vessel CSV. The system is designed to handle large CSV files efficiently with in-memory caching.

