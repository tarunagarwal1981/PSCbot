const fs = require('fs');
const path = require('path');

const TEMP_DIR = '/tmp';

// Import metadata functions from generate-excel
// In a real implementation, these would be in a shared module
const fileMetadata = new Map();

/**
 * @param {any} event
 */
exports.handler = async (event) => {
  try {
    const { file, id } = event.queryStringParameters || {};

    if (!file || !id) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing file or id parameter' }),
      };
    }

    // In production, retrieve metadata from Redis/database
    // For now, we'll check if file exists and is recent
    const filepath = path.join(TEMP_DIR, file);

    if (!fs.existsSync(filepath)) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'File not found or expired' }),
      };
    }

    // Check file age (should be less than 5 minutes)
    const stats = fs.statSync(filepath);
    const fileAge = Date.now() - stats.mtimeMs;
    const maxAge = 5 * 60 * 1000; // 5 minutes

    if (fileAge > maxAge) {
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

    // Read and return file
    const fileBuffer = fs.readFileSync(filepath);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${file}"`,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'no-cache',
      },
      body: fileBuffer.toString('base64'),
      isBase64Encoded: true,
    };
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


