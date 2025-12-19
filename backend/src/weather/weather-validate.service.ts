import { Injectable } from '@nestjs/common';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/**
 * Validate DD-MMM-YY format (e.g., 01-Dec-24)
 */
function isValidDDMMMYY(s: string): boolean {
  if (!s || typeof s !== 'string') return false;
  
  const m = s.trim().match(/^(\d{2})-([A-Za-z]{3})-(\d{2})$/);
  if (!m) return false;

  const dd = Number(m[1]);
  const mon = m[2].slice(0, 1).toUpperCase() + m[2].slice(1).toLowerCase();
  const yy = Number(m[3]);

  if (dd < 1 || dd > 31) return false;
  if (!MONTHS.includes(mon as any)) return false;
  if (yy < 0 || yy > 99) return false;

  return true;
}

/**
 * Normalize DD-MMM-YY to consistent format
 */
function normalizeDDMMMYY(s: string): string {
  if (!s || typeof s !== 'string') return s;
  
  const m = s.trim().match(/^(\d{2})-([A-Za-z]{3})-(\d{2})$/);
  if (!m) return s;
  
  const dd = m[1];
  const mon = m[2].slice(0, 1).toUpperCase() + m[2].slice(1).toLowerCase();
  const yy = m[3];
  
  return `${dd}-${mon}-${yy}`;
}

/**
 * Validate HH:MM format (24-hour)
 */
function isValidHHMM(s: string): boolean {
  if (!s || typeof s !== 'string') return false;
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s.trim());
}

/**
 * Normalize time to HH:MM format
 */
function normalizeHHMM(s: string): string {
  if (!s || typeof s !== 'string') return s;
  
  // Handle HH:MM:SS format - drop seconds
  const m = s.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return s.trim();
  
  const hh = String(Number(m[1])).padStart(2, '0');
  const mm = m[2];
  
  return `${hh}:${mm}`;
}

export interface RowError {
  rowNumber: number;
  errors: string[];
}

export interface ValidationResult {
  rows: Record<string, any>[];
  errors: RowError[];
  isValid: boolean;
}

@Injectable()
export class WeatherValidateService {
  /**
   * Validate all rows according to Weather validation rules from requirements:
   * 
   * 1) Date & Time
   *    - Date format: DD-MMM-YY (e.g., 01-Dec-24)
   *    - Time format: HH:MM (24-hour, e.g., 09:30)
   *    - No duplicate date+time combinations
   * 
   * 2) POA Pyranometer (W/m²): 0-1500, zeros allowed
   * 3) GHI Pyranometer (W/m²): 0-1500, zeros allowed
   * 4) Albedo Up/Down (W/m²): 0-1500, zeros allowed
   * 5) Module Temperature (°C): > 0 (cannot be 0), no negatives
   * 6) Ambient Temperature (°C): >= 0, zeros allowed
   * 7) Wind Speed / Rainfall / Humidity: >= 0, zeros allowed
   */
  validateRows(rows: Record<string, any>[]): ValidationResult {
    const errors: RowError[] = [];
    const seenDateTime = new Set<string>();

    const validatedRows = rows.map((row, index) => {
      const rowErrors: string[] = [];
      const rowNumber = index + 2; // Excel row number (1-indexed + header)

      // Get and normalize Date and Time
      const rawDate = row['Date'] ?? row['date'] ?? '';
      const rawTime = row['Time'] ?? row['time'] ?? '';

      const date = rawDate ? normalizeDDMMMYY(String(rawDate).trim()) : '';
      const time = rawTime ? normalizeHHMM(String(rawTime).trim()) : '';

      // 1) Date & Time Validation
      if (!date) {
        rowErrors.push('Missing Date');
      } else if (!isValidDDMMMYY(date)) {
        rowErrors.push('Invalid Date format (expected DD-MMM-YY, e.g., 01-Dec-24)');
      }

      if (!time) {
        rowErrors.push('Missing Time');
      } else if (!isValidHHMM(time)) {
        rowErrors.push('Invalid Time format (expected HH:MM 24-hour, e.g., 09:30)');
      }

      // Check for duplicate date+time
      if (date && time && isValidDDMMMYY(date) && isValidHHMM(time)) {
        const key = `${date}_${time}`;
        if (seenDateTime.has(key)) {
          rowErrors.push('Duplicate Date & Time combination');
        } else {
          seenDateTime.add(key);
        }
      }

      // Helper to check numeric range
      const checkRange = (
        value: any,
        min: number,
        max: number,
        field: string,
        allowZero: boolean = true,
      ) => {
        if (value === null || value === undefined || value === '') return;

        const num = Number(value);
        if (isNaN(num)) {
          rowErrors.push(`${field} must be a number`);
          return;
        }

        if (!allowZero && num === 0) {
          rowErrors.push(`${field} cannot be 0`);
          return;
        }

        if (num < min || num > max) {
          rowErrors.push(`${field} must be between ${min} and ${max}`);
        }
      };

      // 2) POA Pyranometer (W/m²): 0-1500, zeros allowed
      checkRange(row['POA'], 0, 1500, 'POA Pyranometer', true);

      // 3) GHI Pyranometer (W/m²): 0-1500, zeros allowed
      checkRange(row['GHI'], 0, 1500, 'GHI Pyranometer', true);

      // 4) Albedo Up/Down (W/m²): 0-1500, zeros allowed
      checkRange(row['AlbedoUp'], 0, 1500, 'Albedo Up', true);
      checkRange(row['AlbedoDown'], 0, 1500, 'Albedo Down', true);

      // 5) Module Temperature (°C): > 0 (cannot be 0), no negatives
      const moduleTemp = row['ModuleTemp'];
      if (moduleTemp !== null && moduleTemp !== undefined && moduleTemp !== '') {
        const num = Number(moduleTemp);
        if (isNaN(num)) {
          rowErrors.push('Module Temperature must be a number');
        } else if (num === 0) {
          rowErrors.push('Module Temperature cannot be 0');
        } else if (num < 0) {
          rowErrors.push('Module Temperature cannot be negative');
        } else if (num > 100) {
          rowErrors.push('Module Temperature must be ≤ 100°C');
        }
      }

      // 6) Ambient Temperature (°C): >= 0, zeros allowed
      checkRange(row['AmbientTemp'], 0, 100, 'Ambient Temperature', true);

      // 7) Wind Speed / Rainfall / Humidity: >= 0, zeros allowed
      checkRange(row['WindSpeed'], 0, 200, 'Wind Speed', true);
      checkRange(row['Rainfall'], 0, 500, 'Rainfall', true);
      checkRange(row['Humidity'], 0, 100, 'Humidity', true);

      // Collect errors for this row
      if (rowErrors.length > 0) {
        errors.push({ rowNumber, errors: rowErrors });
      }

      // Return the row with normalized values
      return {
        ...row,
        Date: date || row['Date'],
        Time: time || row['Time'],
      };
    });

    return {
      rows: validatedRows,
      errors,
      isValid: errors.length === 0,
    };
  }
}