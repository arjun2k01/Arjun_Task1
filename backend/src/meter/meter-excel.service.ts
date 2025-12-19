import { Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';

@Injectable()
export class MeterExcelService {
  /**
   * Parse Excel file and return all rows as objects
   * Handles complex Excel files with multi-row headers
   */
  async parseExcel(fileBuffer: Buffer | Uint8Array): Promise<Record<string, any>[]> {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

    // Get the first sheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    if (!worksheet) {
      throw new Error('Worksheet not found in Excel file');
    }

    // Parse as raw array to handle multi-row headers
    const rawData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      raw: false,
      defval: '',
    }) as any[][];

    console.log(`[MeterExcelService] Total raw rows: ${rawData.length}`);

    // Find the data start row (skip header rows)
    // Look for a row that starts with a date-like value
    let dataStartRow = 0;
    for (let i = 0; i < Math.min(10, rawData.length); i++) {
      const firstCell = String(rawData[i]?.[0] || '').trim();
      // Check if it looks like a date (contains / or - with numbers, but not header text)
      if (
        firstCell &&
        !firstCell.toLowerCase().includes('date') &&
        !firstCell.toLowerCase().includes('plant') &&
        (/\d+[\/\-]\w+[\/\-]\d+/.test(firstCell) || /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(firstCell))
      ) {
        dataStartRow = i;
        break;
      }
    }

    console.log(`[MeterExcelService] Data starts at row ${dataStartRow}`);

    // Analyze header rows to build column mapping
    // The solar-plant.xlsx has structure like:
    // Row 0: Date, Plant_Start, Plant_Stop, Total, Export-1_(kWh), '', '', Export-2_(kWh), ...
    // Row 1: '', '', '', '', Initial Reading, Final Reading, Total Exp, Initial Reading, ...
    // Row 2+: Data rows

    const headerRow0 = rawData[0] || [];
    const headerRow1 = rawData[1] || [];

    // Build column mapping
    const columnMap = this.buildColumnMap(headerRow0, headerRow1);
    console.log(`[MeterExcelService] Column mapping:`, JSON.stringify(columnMap));

    // Parse data rows
    const rows = rawData.slice(dataStartRow).map((row: any[]) => {
      const rowData: Record<string, any> = {};

      // Date (column 0)
      rowData['Date'] = this.normalizeDate(row[0]);

      // Plant Start Time (column 1) - may be empty, will be auto-calculated
      rowData['Start Time'] = this.normalizeTime(row[1]);

      // Plant Stop Time (column 2) - may be empty, will be auto-calculated
      rowData['Stop Time'] = this.normalizeTime(row[2]);

      // Total (column 3) - may be empty, will be auto-calculated
      rowData['Total'] = row[3] || '';

      // Export/Import readings - dynamic based on Excel structure
      // Typically: Export-1 Initial (4), Export-1 Final (5), Export-1 Total (6)
      //           Export-2 Initial (7), Export-2 Final (8), Export-2 Total (9), etc.
      
      let colIndex = 4;
      let exportNum = 1;
      let importNum = 1;

      while (colIndex < row.length) {
        const header0 = String(headerRow0[colIndex] || '').toLowerCase();
        
        if (header0.includes('export')) {
          // Found an export group
          rowData[`Export ${exportNum} Initial`] = row[colIndex] || '';
          rowData[`Export ${exportNum} Final`] = row[colIndex + 1] || '';
          rowData[`Export ${exportNum} Total`] = row[colIndex + 2] || '';
          exportNum++;
          colIndex += 3;
        } else if (header0.includes('import')) {
          // Found an import group
          rowData[`Import ${importNum} Initial`] = row[colIndex] || '';
          rowData[`Import ${importNum} Final`] = row[colIndex + 1] || '';
          rowData[`Import ${importNum} Total`] = row[colIndex + 2] || '';
          importNum++;
          colIndex += 3;
        } else if (header0.includes('gss')) {
          // GSS columns
          if (header0.includes('export')) {
            rowData['GSS Export Initial'] = row[colIndex] || '';
            rowData['GSS Export Final'] = row[colIndex + 1] || '';
            rowData['GSS Export Total'] = row[colIndex + 2] || '';
          } else if (header0.includes('import')) {
            rowData['GSS Import Initial'] = row[colIndex] || '';
            rowData['GSS Import Final'] = row[colIndex + 1] || '';
            rowData['GSS Import Total'] = row[colIndex + 2] || '';
          }
          colIndex += 3;
        } else {
          // Unknown column, try to map based on position
          if (row[colIndex] !== undefined && row[colIndex] !== '') {
            const key = columnMap[colIndex] || `Column_${colIndex}`;
            rowData[key] = row[colIndex];
          }
          colIndex++;
        }
      }

      return rowData;
    }).filter(row => row['Date'] && row['Date'].trim() !== '');

    console.log(`[MeterExcelService] Parsed ${rows.length} data rows`);
    if (rows.length > 0) {
      console.log(`[MeterExcelService] First row keys:`, Object.keys(rows[0]));
    }

    return rows;
  }

  /**
   * Build column mapping from multi-row headers
   */
  private buildColumnMap(headerRow0: any[], headerRow1: any[]): Record<number, string> {
    const map: Record<number, string> = {};
    let currentGroup = '';

    for (let i = 0; i < headerRow0.length; i++) {
      const h0 = String(headerRow0[i] || '').trim();
      const h1 = String(headerRow1[i] || '').trim();

      if (h0) {
        currentGroup = h0;
      }

      if (h1) {
        map[i] = `${currentGroup} - ${h1}`.replace(/[\r\n]+/g, ' ').trim();
      } else if (h0) {
        map[i] = h0.replace(/[\r\n]+/g, ' ').trim();
      }
    }

    return map;
  }

  /**
   * Normalize date to DD-MM-YYYY format
   */
  private normalizeDate(value: any): string {
    if (!value) return '';
    const str = String(value).trim();

    // Already in DD-MM-YYYY format
    if (/^\d{2}-\d{2}-\d{4}$/.test(str)) {
      return str;
    }

    // Format: D/Mon/YY or DD/Mon/YY (e.g., 1/Jun/25 or 22/Jun/25)
    const match1 = str.match(/^(\d{1,2})\/([A-Za-z]{3})\/(\d{2,4})$/);
    if (match1) {
      const day = match1[1].padStart(2, '0');
      const monthStr = match1[2];
      const months: Record<string, string> = {
        'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
        'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
        'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
      };
      const month = months[monthStr.toLowerCase()] || '01';
      const year = match1[3].length === 2 ? `20${match1[3]}` : match1[3];
      return `${day}-${month}-${year}`;
    }

    // Format: DD/MM/YYYY or D/M/YYYY
    const match2 = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (match2) {
      const day = match2[1].padStart(2, '0');
      const month = match2[2].padStart(2, '0');
      const year = match2[3].length === 2 ? `20${match2[3]}` : match2[3];
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
      meterData: rows,
      rows: rows,
      errors: [],
    };
  }
}