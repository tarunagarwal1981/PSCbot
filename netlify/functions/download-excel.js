const fs = require('fs');
const path = require('path');

const TEMP_DIR = '/tmp';
const MAX_FILE_AGE_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Validate filename to prevent directory traversal and ensure security
 * Only allows alphanumeric characters, dashes, underscores, and .xlsx extension
 * @param {string} filename - The filename to validate
 * @returns {boolean} - True if valid, false otherwise
 */
function validateFilename(filename) {
  if (!filename || typeof filename !== 'string') {
    return false;
  }

  // Must end with .xlsx
  if (!filename.toLowerCase().endsWith('.xlsx')) {
    return false;
  }

  // Remove .xlsx extension for validation
  const nameWithoutExt = filename.slice(0, -5);

  // Only allow alphanumeric, dash, and underscore
  // This prevents directory traversal (../, ..\, etc.) and other malicious patterns
  const validPattern = /^[a-zA-Z0-9_-]+$/;
  
  return validPattern.test(nameWithoutExt);
}

/**
 * Extract vessel and date information from filename
 * Expected format: recommendations_{vessel}_{timestamp}.xlsx
 * @param {string} filename - The filename to parse
 * @returns {{vessel: string, date: string}} - Extracted vessel and date
 */
function parseFilename(filename) {
  // Remove .xlsx extension
  const nameWithoutExt = filename.slice(0, -5);
  
  // Split by underscore
  const parts = nameWithoutExt.split('_');
  
  // Expected format: recommendations_{vessel}_{timestamp}
  let vessel = 'Vessel';
  let date = new Date().toISOString().split('T')[0]; // Default to today
  
  if (parts.length >= 3) {
    // Vessel is typically the second part (index 1)
    vessel = parts[1] || 'Vessel';
    
    // Timestamp is the last part
    const timestamp = parts[parts.length - 1];
    if (timestamp && /^\d+$/.test(timestamp)) {
      // Convert timestamp to date
      const dateObj = new Date(parseInt(timestamp, 10));
      if (!isNaN(dateObj.getTime())) {
        date = dateObj.toISOString().split('T')[0];
      }
    }
  } else if (parts.length === 2) {
    vessel = parts[1] || 'Vessel';
  }
  
  return { vessel: String(vessel), date: String(date) };
}

/**
 * Clean up old files in /tmp directory (older than MAX_FILE_AGE_MS)
 * This is a best-effort cleanup that runs on each request
 */
function cleanupOldFiles() {
  try {
    if (!fs.existsSync(TEMP_DIR)) {
      return;
    }

    const files = fs.readdirSync(TEMP_DIR);
    const now = Date.now();

    files.forEach((/** @type {string} */ file) => {
      // Only process .xlsx files
      if (!file.toLowerCase().endsWith('.xlsx')) {
        return;
      }

      try {
        const filepath = path.join(TEMP_DIR, file);
        const stats = fs.statSync(filepath);
        const fileAge = now - stats.mtimeMs;

        if (fileAge > MAX_FILE_AGE_MS) {
          fs.unlinkSync(filepath);
          console.log(`Cleaned up expired file: ${file}`);
        }
      } catch (err) {
        // Ignore errors for individual files (may have been deleted already)
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.warn(`Error cleaning up file ${file}:`, errorMessage);
      }
    });
  } catch (err) {
    // Ignore cleanup errors - don't fail the request
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.warn('Error during cleanup:', errorMessage);
  }
}

/**
 * Netlify serverless function handler
 * Serves Excel files from /tmp directory with security validation
 * @param {any} event - Netlify function event object
 * @returns {Promise<any>} - HTTP response
 */
exports.handler = async (event) => {
  console.log('[download-excel] Request received', { 
    method: event.httpMethod,
    query: event.queryStringParameters 
  });

  // Only accept GET requests
  if (event.httpMethod !== 'GET') {
    console.warn('[download-excel] Invalid method', { method: event.httpMethod });
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    // Clean up old files on each request (best-effort)
    cleanupOldFiles();

    // Get filename from query parameters
    const queryParams = event.queryStringParameters || {};
    const file = queryParams.file;

    if (!file || typeof file !== 'string') {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing file parameter' }),
      };
    }

    // Validate filename for security
    if (!validateFilename(file)) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'Invalid filename. Only alphanumeric characters, dashes, underscores, and .xlsx extension are allowed.' 
        }),
      };
    }

    // Construct file path (path.join prevents directory traversal)
    const filepath = path.join(TEMP_DIR, path.basename(file));

    // Additional security check: ensure the resolved path is still within TEMP_DIR
    const resolvedPath = path.resolve(filepath);
    const resolvedTempDir = path.resolve(TEMP_DIR);
    
    if (!resolvedPath.startsWith(resolvedTempDir)) {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Access denied' }),
      };
    }

    // Check if file exists
    if (!fs.existsSync(filepath)) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'File not found or expired' }),
      };
    }

    // Check file age (should be less than 10 minutes)
    const stats = fs.statSync(filepath);
    const fileAge = Date.now() - stats.mtimeMs;

    if (fileAge > MAX_FILE_AGE_MS) {
      // File expired, delete it
      try {
        fs.unlinkSync(filepath);
      } catch (err) {
        console.error('Error deleting expired file:', err);
      }
      return {
        statusCode: 410,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'File has expired' }),
      };
    }

    // Read file
    let fileBuffer;
    try {
      fileBuffer = fs.readFileSync(filepath);
    } catch (readError) {
      console.error('Error reading file:', readError);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'Failed to read file',
          message: readError instanceof Error ? readError.message : String(readError)
        }),
      };
    }

    // Parse filename to extract vessel and date for Content-Disposition
    const { vessel, date } = parseFilename(file);
    const displayFilename = `Recommendations_${vessel}_${date}.xlsx`;

    // Prepare response
    const response = {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${displayFilename}"`,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
      body: fileBuffer.toString('base64'),
      isBase64Encoded: true,
    };

    // Delete file after sending (cleanup)
    // Note: In serverless environments, the file will be deleted after the function completes
    // We attempt to delete it here, but if it fails, it's not critical
    try {
      fs.unlinkSync(filepath);
      console.log(`File deleted after serving: ${file}`);
    } catch (deleteError) {
      // Log but don't fail the request - file will be cleaned up by age check anyway
      const errorMessage = deleteError instanceof Error ? deleteError.message : String(deleteError);
      console.warn(`Warning: Could not delete file ${file} after serving:`, errorMessage);
    }

    return response;
  } catch (error) {
    console.error('Error serving Excel file:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Failed to serve file',
        message: errorMessage,
      }),
    };
  }
};
