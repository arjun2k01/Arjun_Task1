import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Meter, MeterDocument } from './meter.schema';
import axios from 'axios';

/**
 * Service to sync meter data to SolarPowerMeter DailyGeneration
 * This creates automatic data flow: Meter → DailyGeneration
 */
@Injectable()
export class MeterSyncService {
  private readonly logger = new Logger(MeterSyncService.name);

  // Configure the SolarPowerMeter API endpoint
  private readonly solarMeterApiUrl = process.env.SOLAR_METER_API_URL || 'http://localhost:5001/api';

  constructor(
    @InjectModel(Meter.name) private readonly meterModel: Model<MeterDocument>,
  ) {}

  /**
   * Sync submitted meter data to SolarPowerMeter DailyGeneration
   * Groups by date and calculates daily totals from activeEnergyExport
   */
  async syncToDailyGeneration(dateRange?: { startDate: string; endDate: string }) {
    try {
      this.logger.log('Starting sync to DailyGeneration...');

      // Build query for submitted meter records
      const query: any = { status: 'submitted' };

      if (dateRange) {
        // Date range filter
        query.date = {
          $gte: dateRange.startDate,
          $lte: dateRange.endDate,
        };
      }

      // Fetch all submitted meter records
      const meterRecords = await this.meterModel.find(query).lean().exec();

      if (meterRecords.length === 0) {
        this.logger.log('No submitted meter records found to sync');
        return { synced: 0, message: 'No records to sync' };
      }

      // Group by date and calculate daily totals
      const dailyTotals = this.aggregateDailyTotals(meterRecords);

      this.logger.log(`Aggregated ${dailyTotals.length} daily records`);

      // Get or create site mapping
      const siteMapping = await this.getSiteMapping();

      // Sync each daily total to SolarPowerMeter
      const syncResults: Array<{ date: string; success: boolean; data?: any; error?: string }> = [];
      for (const dailyRecord of dailyTotals) {
        try {
          const siteId = siteMapping[dailyRecord.siteName] || siteMapping['default'];

          if (!siteId) {
            this.logger.warn(`No site mapping found for ${dailyRecord.siteName}, skipping`);
            continue;
          }

          // Convert DD-MM-YYYY to Date object
          const [day, month, year] = dailyRecord.date.split('-').map(Number);
          const dateObj = new Date(year, month - 1, day); // month is 0-indexed

          const payload = {
            site: siteId,
            date: dateObj.toISOString(),
            dailyGeneration: dailyRecord.totalExport,
            status: 'submitted',
          };

          // Post to SolarPowerMeter DailyGeneration API
          const response = await axios.post(
            `${this.solarMeterApiUrl}/daily-generation`,
            payload,
            { timeout: 10000 }
          );

          syncResults.push({ date: dailyRecord.date, success: true, data: response.data });
          this.logger.log(`Synced ${dailyRecord.date}: ${dailyRecord.totalExport} kWh`);
        } catch (error) {
          this.logger.error(`Failed to sync ${dailyRecord.date}: ${error.message}`);
          syncResults.push({ date: dailyRecord.date, success: false, error: error.message });
        }
      }

      const successCount = syncResults.filter(r => r.success).length;

      return {
        synced: successCount,
        total: dailyTotals.length,
        results: syncResults,
        message: `Synced ${successCount} out of ${dailyTotals.length} daily records`,
      };
    } catch (error) {
      this.logger.error(`Sync failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Aggregate meter records by date to get daily totals
   * Uses activeEnergyExport as the daily generation value
   */
  private aggregateDailyTotals(meterRecords: any[]): Array<{
    date: string;
    siteName: string;
    totalExport: number;
    recordCount: number;
  }> {
    const dailyMap = new Map<string, { siteName: string; totalExport: number; count: number }>();

    for (const record of meterRecords) {
      const key = record.date;

      if (!dailyMap.has(key)) {
        dailyMap.set(key, {
          siteName: record.siteName || 'Unknown Site',
          totalExport: 0,
          count: 0,
        });
      }

      const daily = dailyMap.get(key)!;
      // Sum up activeEnergyExport (this represents daily generation in kWh)
      daily.totalExport += record.activeEnergyExport || 0;
      daily.count += 1;
    }

    return Array.from(dailyMap.entries()).map(([date, data]) => ({
      date,
      siteName: data.siteName,
      totalExport: data.totalExport,
      recordCount: data.count,
    }));
  }

  /**
   * Get site name to ObjectId mapping from SolarPowerMeter
   * This maps siteName from meter data to Site._id in SolarPowerMeter
   */
  private async getSiteMapping(): Promise<Record<string, string>> {
    try {
      const response = await axios.get(`${this.solarMeterApiUrl}/sites`, { timeout: 5000 });
      const sites = response.data;

      const mapping: Record<string, string> = {};

      for (const site of sites) {
        // Map by siteName (case-insensitive)
        mapping[site.siteName.toLowerCase()] = site._id;

        // Also map by siteNumber if available
        if (site.siteNumber) {
          mapping[`site-${site.siteNumber}`] = site._id;
        }
      }

      // Set default site if available
      if (sites.length > 0) {
        mapping['default'] = sites[0]._id;
      }

      this.logger.log(`Loaded site mapping: ${Object.keys(mapping).length} mappings`);
      return mapping;
    } catch (error) {
      this.logger.error(`Failed to fetch site mapping: ${error.message}`);
      // Return empty mapping - will skip records without mapping
      return {};
    }
  }

  /**
   * Sync a specific date's meter data
   */
  async syncDate(date: string) {
    return this.syncToDailyGeneration({ startDate: date, endDate: date });
  }

  /**
   * Auto-sync after meter data submission
   * This is called automatically when meter data status changes to 'submitted'
   */
  async autoSyncOnSubmit(submittedRecords: any[]) {
    try {
      if (!submittedRecords || submittedRecords.length === 0) {
        return { synced: 0, message: 'No records to auto-sync' };
      }

      // Extract unique dates from submitted records
      const dates = [...new Set(submittedRecords.map(r => r.date))];

      this.logger.log(`Auto-syncing ${dates.length} dates after submission`);

      // Sync each date
      const results: Array<{ synced: number; total?: number; results?: any[]; message: string }> = [];
      for (const date of dates) {
        const result = await this.syncDate(date);
        results.push(result);
      }

      return {
        synced: results.reduce((sum, r) => sum + (r.synced || 0), 0),
        dates: dates.length,
        message: `Auto-synced ${dates.length} dates`,
      };
    } catch (error) {
      this.logger.error(`Auto-sync failed: ${error.message}`);
      // Don't throw - auto-sync failure shouldn't block submission
      return { synced: 0, error: error.message };
    }
  }
}
