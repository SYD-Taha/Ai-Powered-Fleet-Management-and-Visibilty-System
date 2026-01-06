/**
 * Debug Logger for Runtime Evidence Collection
 * Writes NDJSON logs directly to file for debug mode
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Log file path (must match system reminder)
const LOG_PATH = path.join(__dirname, '../../.cursor/debug.log');

/**
 * Write debug log entry to file (NDJSON format)
 * @param {Object} entry - Log entry object
 */
export const logDebug = (entry) => {
  try {
    // Ensure log directory exists
    const logDir = path.dirname(LOG_PATH);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    // Append NDJSON line to log file
    const logLine = JSON.stringify({
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      ...entry
    }) + '\n';

    fs.appendFileSync(LOG_PATH, logLine, 'utf8');
  } catch (error) {
    // Silently fail - don't break the application if logging fails
    console.error('Debug logger error:', error.message);
  }
};


