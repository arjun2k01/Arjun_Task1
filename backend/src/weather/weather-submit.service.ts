import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Weather, WeatherDocument } from './schemas/weather.schema';

@Injectable()
export class WeatherSubmitService {
  constructor(
    @InjectModel(Weather.name)
    private readonly weatherModel: Model<WeatherDocument>,
  ) { }

  async submitRows(rows: Record<string, any>[]) {
    if (!rows || rows.length === 0) {
      return {
        inserted: 0,
        updated: 0,
        skipped: 0,
        message: 'No data provided',
      };
    }

    // OPTIMIZATION: Use bulkWrite with upsert instead of checking existence per row
    const ops: any[] = [];
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

      // Map row to schema fields
      const doc: Record<string, any> = {
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
        status: row['status'] ?? row['Status'] ?? 'draft',
      };

      const siteName = this.toText(
        row['Site Name'] ?? row['SiteName'] ?? row['siteName'] ?? row['Site'] ?? row['site'],
      );
      if (siteName) {
        doc.siteName = siteName;
      }

      // Use upsert to handle duplicates automatically
      ops.push({
        updateOne: {
          filter: { date, time },
          update: { $set: doc },
          upsert: true,
        },
      });
    }

    // Bulk write all operations in one call with unordered for max performance
    let result = { insertedCount: 0, modifiedCount: 0, upsertedCount: 0 };
    if (ops.length > 0) {
      const bulkResult = await this.weatherModel.bulkWrite(ops, { ordered: false });
      result = {
        insertedCount: bulkResult.insertedCount ?? 0,
        modifiedCount: bulkResult.modifiedCount ?? 0,
        upsertedCount: bulkResult.upsertedCount ?? 0,
      };
    }

    const totalInserted = result.upsertedCount;
    const totalUpdated = result.modifiedCount;

    return {
      inserted: totalInserted,
      updated: totalUpdated,
      skipped,
      message: `Weather data submission completed. ${totalInserted} inserted, ${totalUpdated} updated, ${skipped} skipped.`,
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

  private toText(value: any): string | null {
    if (value === null || value === undefined) return null;
    const text = String(value).trim();
    return text ? text : null;
  }
}
