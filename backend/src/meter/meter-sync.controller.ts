import { Controller, Post, Get, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { MeterSyncService } from './meter-sync.service';
import { MeterService } from './meter.service';

/**
 * Controller for manual sync and data export/import operations
 * Provides endpoints for:
 * - Manual sync to SolarPowerMeter DailyGeneration
 * - Export meter data in required format
 * - Import meter data from external sources
 */
@Controller('meter/sync')
export class MeterSyncController {
  constructor(
    private readonly syncService: MeterSyncService,
    private readonly meterService: MeterService,
  ) {}

  /**
   * POST /meter/sync
   * Manually sync submitted meter data to SolarPowerMeter DailyGeneration
   *
   * Body (optional):
   * {
   *   "startDate": "01-07-2024",
   *   "endDate": "31-07-2024"
   * }
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async syncToDailyGeneration(@Body() body?: { startDate?: string; endDate?: string }) {
    const dateRange = body?.startDate && body?.endDate
      ? { startDate: body.startDate, endDate: body.endDate }
      : undefined;

    return this.syncService.syncToDailyGeneration(dateRange);
  }

  /**
   * POST /meter/sync/date
   * Sync a specific date's meter data
   *
   * Body:
   * {
   *   "date": "15-07-2024"
   * }
   */
  @Post('date')
  @HttpCode(HttpStatus.OK)
  async syncDate(@Body() body: { date: string }) {
    if (!body.date) {
      return { error: 'Date is required' };
    }

    return this.syncService.syncDate(body.date);
  }

  /**
   * GET /meter/sync/export
   * Export meter data in CSV format for manual import to SolarPowerMeter
   *
   * Query params:
   * - startDate: DD-MM-YYYY
   * - endDate: DD-MM-YYYY
   * - format: 'csv' | 'json' (default: 'json')
   */
  @Get('export')
  async exportData(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('format') format: 'csv' | 'json' = 'json',
  ) {
    const query: any = { status: 'submitted' };

    if (startDate && endDate) {
      query.date = { $gte: startDate, $lte: endDate };
    }

    const records = await this.meterService.findAll(query);

    // Group by date for daily totals
    const dailyRecords = this.aggregateByDate(records);

    if (format === 'csv') {
      return this.convertToCSV(dailyRecords);
    }

    return {
      total: dailyRecords.length,
      records: dailyRecords,
      exportedAt: new Date().toISOString(),
    };
  }

  /**
   * GET /meter/sync/status
   * Get sync status and statistics
   */
  @Get('status')
  async getSyncStatus() {
    // Count records by status
    const submitted = await this.meterService.count({ status: 'submitted' });
    const draft = await this.meterService.count({ status: 'draft' });
    const total = submitted + draft;

    return {
      total,
      submitted,
      draft,
      syncable: submitted,
      lastChecked: new Date().toISOString(),
    };
  }

  /**
   * Helper: Aggregate meter records by date
   */
  private aggregateByDate(records: any[]): Array<{
    date: string;
    siteName: string;
    dailyGeneration: number;
    plantStartTime: string;
    plantStopTime: string;
    totalOperationTime: string;
  }> {
    const dailyMap = new Map<string, any>();

    for (const record of records) {
      const key = record.date;

      if (!dailyMap.has(key)) {
        dailyMap.set(key, {
          date: record.date,
          siteName: record.siteName || 'Unknown Site',
          dailyGeneration: 0,
          plantStartTime: record.plantStartTime || '00:00',
          plantStopTime: record.plantStopTime || '00:00',
          totalOperationTime: record.total || '00:00',
          recordCount: 0,
        });
      }

      const daily = dailyMap.get(key)!;
      daily.dailyGeneration += record.activeEnergyExport || 0;
      daily.recordCount += 1;
    }

    return Array.from(dailyMap.values());
  }

  /**
   * Helper: Convert data to CSV format
   */
  private convertToCSV(records: any[]): string {
    if (records.length === 0) {
      return 'Date,Site Name,Daily Generation (kWh),Plant Start Time,Plant Stop Time,Total Operation Time\n';
    }

    const headers = 'Date,Site Name,Daily Generation (kWh),Plant Start Time,Plant Stop Time,Total Operation Time\n';
    const rows = records.map(r =>
      `${r.date},${r.siteName},${r.dailyGeneration},${r.plantStartTime},${r.plantStopTime},${r.totalOperationTime}`
    ).join('\n');

    return headers + rows;
  }
}
