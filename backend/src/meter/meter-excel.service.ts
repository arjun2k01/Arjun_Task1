import { Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';  // Ensure XLSX (SheetJS) is imported correctly
import { MeterData, RowErrorDto } from './meter-data.types';  // Import types from the new file

@Injectable()
export class MeterExcelService {

  // Helper function to validate numeric values
  isNumeric(value: any): boolean {
    return !isNaN(value) && value !== null && value !== '';
  }

  // Function to handle POA Pyranometer validation (0 <= value <= 1500)
  isValidPOA(value: any): boolean {
    return value >= 0 && value <= 1500;
  }

  // Function to handle GHI Pyranometer validation (0 <= value <= 1500)
  isValidGHI(value: any): boolean {
    return value >= 0 && value <= 1500;
  }

  // Function to handle Albedo validation (0 <= value <= 1500)
  isValidAlbedo(value: any): boolean {
    return value >= 0 && value <= 1500;
  }

  // Function to handle temperature validation (greater than 0 for Module Temp, >= 0 for Ambient Temp)
  isValidTemperature(value: any): boolean {
    return value > 0;
  }

  // Function to validate non-negative values (Wind Speed, Rainfall, Humidity)
  isValidNonNegative(value: any): boolean {
    return value >= 0;
  }

  // Parse and validate the meter data from the uploaded Excel file
  async parseAndValidate(fileBuffer: Buffer | Uint8Array) {
    let meterData: MeterData[] = [];
    const errors: RowErrorDto[] = [];

    try {
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      if (!worksheet) {
        throw new Error('Worksheet not found.');
      }

      // Convert worksheet to JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      jsonData.forEach((row: MeterData, index: number) => {
        const rowErrors: string[] = [];

        // Validate POA Pyranometer
        if (!this.isValidPOA(row.poA)) {
          rowErrors.push(`Invalid POA Pyranometer at row ${index + 1}`);
        }

        // Validate GHI Pyranometer
        if (!this.isValidGHI(row.ghi)) {
          rowErrors.push(`Invalid GHI Pyranometer at row ${index + 1}`);
        }

        // Validate Albedo
        if (!this.isValidAlbedo(row.albedo)) {
          rowErrors.push(`Invalid Albedo at row ${index + 1}`);
        }

        // Validate Module Temperature
        if (!this.isValidTemperature(row.moduleTemperature)) {
          rowErrors.push(`Invalid Module Temperature at row ${index + 1}`);
        }

        // Validate Ambient Temperature
        if (!this.isValidTemperature(row.ambientTemperature)) {
          rowErrors.push(`Invalid Ambient Temperature at row ${index + 1}`);
        }

        // Validate Wind Speed, Rainfall, Humidity
        if (!this.isValidNonNegative(row.windSpeed)) {
          rowErrors.push(`Invalid Wind Speed at row ${index + 1}`);
        }
        if (!this.isValidNonNegative(row.rainfall)) {
          rowErrors.push(`Invalid Rainfall at row ${index + 1}`);
        }
        if (!this.isValidNonNegative(row.humidity)) {
          rowErrors.push(`Invalid Humidity at row ${index + 1}`);
        }

        // Collect errors for each row
        if (rowErrors.length > 0) {
          errors.push({ rowNumber: index + 1, errors: rowErrors });
        } else {
          meterData.push(row);
        }
      });

      // Return the validated data and errors
      return { meterData, errors };

    } catch (error) {
      console.error('Error while parsing Excel:', error);
      throw new Error('Failed to parse the Excel file');
    }
  }
}
