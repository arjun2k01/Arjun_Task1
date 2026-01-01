import { Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';

@Injectable()
export class WeatherExcelService {
  /**
   * Parse Excel file and return all rows as objects
   * Handles complex Excel files with merged headers
   */
  async parseExcel(fileBuffer: Buffer | Uint8Array): Promise<Record<string, any>[]> {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

    // Get the first sheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    if (!worksheet) {
      throw new Error('Worksheet not found in Excel file');
    }

    // First try standard parsing
    let jsonData = XLSX.utils.sheet_to_json(worksheet, {
      raw: false,
      defval: '',
    });

    // Check if this is a complex Excel with merged headers
    const firstRow = jsonData[0] as Record<string, any>;
    const hasComplexHeaders = firstRow && (
      Object.keys(firstRow).some(k => k.includes('__EMPTY')) ||
      Object.keys(firstRow).some(k => k.includes('Date/Time')) ||
      Object.keys(firstRow).some(k => k.includes('Irradiance'))
    );

    if (hasComplexHeaders) {
      // Parse as raw array for complex Excel files
      const rawData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        raw: false,
        defval: '',
      }) as any[][];

      // Find the actual data start row (skip header rows)
      let dataStartRow = 0;
      for (let i = 0; i < Math.min(10, rawData.length); i++) {
        const firstCell = String(rawData[i]?.[0] || '').trim();
        // Check if it looks like a date (contains / or - with numbers, but not "Date")
        if (
          firstCell &&
          !firstCell.toLowerCase().includes('date') &&
          (/\d+[\/\-]\w+[\/\-]\d+/.test(firstCell) || /^\d{2}-[A-Za-z]{3}-\d{2}$/.test(firstCell))
        ) {
          dataStartRow = i;
          break;
        }
      }

      console.log(`[WeatherExcelService] Data starts at row ${dataStartRow}`);
      console.log(`[WeatherExcelService] Total raw rows: ${rawData.length}`);

      // Map the raw data to standardized format
      // Column mapping based on actual Excel structure:
      // 0: Date, 1: Time, 2: POA1, 3: POA2, ... 20: GHI, ... 25-26: ModTemp, 31-32: AmbTemp, 36-37: WindSpeed, 41-42: Rainfall, 46-47: Humidity
      const rows = rawData.slice(dataStartRow).map((row: any[]) => {
        return {
          Date: this.normalizeDate(row[0]),
          Time: this.normalizeTime(row[1]),
          POA: this.getFirstValidValue([row[2], row[3], row[4], row[5]]),
          GHI: this.getFirstValidValue([row[20], row[21], row[22], row[23]]),
          AlbedoUp: this.getFirstValidValue([row[7], row[10], row[13], row[16]]),
          AlbedoDown: this.getFirstValidValue([row[8], row[11], row[14], row[17]]),
          ModuleTemp: this.getFirstValidValue([row[25], row[26], row[27], row[28]]),
          AmbientTemp: this.getFirstValidValue([row[31], row[32], row[33], row[34]]),
          WindSpeed: this.getFirstValidValue([row[36], row[37], row[38], row[39]]),
          Rainfall: this.getFirstValidValue([row[41], row[42], row[43], row[44]]),
          Humidity: this.getFirstValidValue([row[46], row[47], row[48], row[49]]),
        };
      }).filter(row => row.Date && row.Date.trim() !== '');

      console.log(`[WeatherExcelService] Parsed ${rows.length} data rows`);
      if (rows.length > 0) {
        console.log(`[WeatherExcelService] First row:`, JSON.stringify(rows[0]));
      }

      return rows;
    } else {
      // Standard Excel format - map to standardized field names
      const rows = jsonData.map((row: any) => {
        return {
          Date: this.normalizeDate(row['Date'] ?? row['date'] ?? row['DATE'] ?? ''),
          Time: this.normalizeTime(row['Time'] ?? row['time'] ?? row['TIME'] ?? ''),
          'Site Name': row['Site Name'] ?? row['SiteName'] ?? row['siteName'] ?? row['Site'] ?? row['site'] ?? '',
          POA: row['POA'] ?? row['POA Pyranometer'] ?? row['poa'] ?? '',
          GHI: row['GHI'] ?? row['GHI Pyranometer'] ?? row['ghi'] ?? '',
          AlbedoUp: row['AlbedoUp'] ?? row['Albedo Up'] ?? row['Albedo (Up)'] ?? '',
          AlbedoDown: row['AlbedoDown'] ?? row['Albedo Down'] ?? row['Albedo (Down)'] ?? '',
          ModuleTemp: row['ModuleTemp'] ?? row['Module Temperature'] ?? row['Module Temp'] ?? '',
          AmbientTemp: row['AmbientTemp'] ?? row['Ambient Temperature'] ?? row['Ambient Temp'] ?? '',
          WindSpeed: row['WindSpeed'] ?? row['Wind Speed'] ?? row['windSpeed'] ?? '',
          Rainfall: row['Rainfall'] ?? row['rainfall'] ?? '',
          Humidity: row['Humidity'] ?? row['humidity'] ?? '',
        };
      }).filter((row: any) => row.Date && row.Date.trim() !== '');

      console.log(`[WeatherExcelService] Parsed ${rows.length} data rows (standard format)`);
      return rows;
    }
  }

  /**
   * Get first non-empty value from array of potential values
   */
  private getFirstValidValue(values: any[]): string {
    for (const v of values) {
      if (v !== null && v !== undefined && v !== '') {
        return String(v);
      }
    }
    return '';
  }

  /**
   * Normalize date to DD-MMM-YY format
   */
  private normalizeDate(value: any): string {
    if (!value) return '';
    const str = String(value).trim();
    
    // Already in DD-MMM-YY format (e.g., 01-Dec-24)
    if (/^\d{2}-[A-Za-z]{3}-\d{2}$/.test(str)) {
      return str;
    }

    // Format: DD/Mon/YY (e.g., 22/Jun/25)
    const match1 = str.match(/^(\d{1,2})\/([A-Za-z]{3})\/(\d{2,4})$/);
    if (match1) {
      const day = match1[1].padStart(2, '0');
      const month = match1[2].charAt(0).toUpperCase() + match1[2].slice(1).toLowerCase();
      const year = match1[3].slice(-2);
      return `${day}-${month}-${year}`;
    }

    // Format: DD-MM-YYYY or DD/MM/YYYY
    const match2 = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (match2) {
      const day = match2[1].padStart(2, '0');
      const monthNum = parseInt(match2[2], 10);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = months[monthNum - 1] || 'Jan';
      const year = match2[3].slice(-2);
      return `${day}-${month}-${year}`;
    }

    return str;
  }

  /**
   * Normalize time to HH:MM format
   */
  private normalizeTime(value: any): string {
    if (!value) return '';
    const str = String(value).trim();

    // Already in HH:MM format
    if (/^\d{2}:\d{2}$/.test(str)) {
      return str;
    }

    // Format: H:MM or HH:MM:SS
    const match = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (match) {
      const hours = match[1].padStart(2, '0');
      const minutes = match[2];
      return `${hours}:${minutes}`;
    }

    return str;
  }

  /**
   * Legacy method - kept for backward compatibility
   * @deprecated Use parseExcel() instead
   */
  async parseAndValidate(fileBuffer: Buffer | Uint8Array) {
    const rows = await this.parseExcel(fileBuffer);
    return {
      weatherData: rows,
      errors: [],
    };
  }
}
