import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Weather, WeatherDocument } from './schemas/weather.schema';

@Injectable()
export class WeatherSubmitService {
  constructor(
    @InjectModel(Weather.name)
    private readonly weatherModel: Model<WeatherDocument>,
  ) {}

  async submitRows(rows: Record<string, any>[]) {
    if (!rows || rows.length === 0) {
      return {
        inserted: 0,
        skipped: 0,
        message: 'No data provided',
      };
    }

    const docsToInsert: any[] = [];
    let skipped = 0;

    for (const row of rows) {
      // Get date and time from row (handle both casing)
      const date = row['Date'] ?? row['date'];
      const time = row['Time'] ?? row['time'];

      // Skip rows without date or time
      if (!date || !time) {
        skipped++;
        continue;
      }

      // Check if record already exists (prevent duplicates)
      const exists = await this.weatherModel.exists({
        $or: [
          { date, time },
          { Date: date, Time: time },
        ],
      });

      if (exists) {
        skipped++;
        continue;
      }

      // Map row to schema fields
      docsToInsert.push({
        date,
        time,
        poa: this.toNumber(row['POA']),
        ghi: this.toNumber(row['GHI']),
        albedoUp: this.toNumber(row['AlbedoUp']),
        albedoDown: this.toNumber(row['AlbedoDown']),
        moduleTemp: this.toNumber(row['ModuleTemp']),
        ambientTemp: this.toNumber(row['AmbientTemp']),
        windSpeed: this.toNumber(row['WindSpeed']),
        rainfall: this.toNumber(row['Rainfall']),
        humidity: this.toNumber(row['Humidity']),
      });
    }

    // Bulk insert all valid documents
    if (docsToInsert.length > 0) {
      await this.weatherModel.insertMany(docsToInsert, { ordered: false });
    }

    return {
      inserted: docsToInsert.length,
      skipped,
      message: `Weather data submission completed. ${docsToInsert.length} inserted, ${skipped} skipped.`,
    };
  }

  /**
   * Convert value to number, return 0 if invalid
   */
  private toNumber(value: any): number {
    if (value === null || value === undefined || value === '') {
      return 0;
    }
    const num = Number(value);
    return isNaN(num) ? 0 : num;
  }
}