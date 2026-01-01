import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Weather, WeatherDocument } from './schemas/weather.schema';

/**
 * Admin controller for bulk operations on weather data
 * Use with caution - these endpoints modify data in bulk
 */
@Controller('weather/admin')
export class WeatherAdminController {
  constructor(
    @InjectModel(Weather.name)
    private readonly weatherModel: Model<WeatherDocument>,
  ) {}

  /**
   * POST /weather/admin/update-site-name
   * Bulk update site name for weather records
   *
   * Body:
   * {
   *   "siteName": "Site-A",                    // Required: New site name
   *   "filter": {                              // Optional: Filter which records to update
   *     "startDate": "22-Jun-25",             // Optional: Start date (DD-MMM-YY)
   *     "endDate": "25-Jun-25",               // Optional: End date (DD-MMM-YY)
   *     "onlyEmpty": true                     // Optional: Only update empty site names (default: true)
   *   }
   * }
   *
   * Example 1: Update all records with empty site name to "Site-A"
   * {
   *   "siteName": "Site-A"
   * }
   *
   * Example 2: Update specific date range
   * {
   *   "siteName": "Site-B",
   *   "filter": {
   *     "startDate": "01-Jul-25",
   *     "endDate": "31-Jul-25",
   *     "onlyEmpty": true
   *   }
   * }
   */
  @Post('update-site-name')
  @HttpCode(HttpStatus.OK)
  async bulkUpdateSiteName(
    @Body() body: {
      siteName: string;
      filter?: {
        startDate?: string;
        endDate?: string;
        onlyEmpty?: boolean;
      };
    },
  ) {
    const { siteName, filter = {} } = body;

    if (!siteName || !siteName.trim()) {
      return {
        success: false,
        message: 'Site name is required',
      };
    }

    const normalizedSiteName = siteName.trim();

    // Build MongoDB query
    const query: any = {};

    // Filter 1: Only update records with empty/null site name (default behavior)
    const onlyEmpty = filter.onlyEmpty !== false; // Default to true
    if (onlyEmpty) {
      query.$or = [
        { siteName: { $exists: false } },
        { siteName: null },
        { siteName: '' },
      ];
    }

    // Filter 2: Date range
    if (filter.startDate || filter.endDate) {
      query.date = {};
      if (filter.startDate) {
        // Greater than or equal to start date (using regex for DD-MMM-YY format)
        query.date.$gte = filter.startDate;
      }
      if (filter.endDate) {
        // Less than or equal to end date
        query.date.$lte = filter.endDate;
      }
    }

    try {
      // Count records that will be updated
      const countBefore = await this.weatherModel.countDocuments(query).exec();

      if (countBefore === 0) {
        return {
          success: true,
          matched: 0,
          modified: 0,
          message: 'No records matched the filter criteria',
          query: query,
        };
      }

      // Perform bulk update
      const result = await this.weatherModel
        .updateMany(query, { $set: { siteName: normalizedSiteName } })
        .exec();

      return {
        success: true,
        matched: result.matchedCount || 0,
        modified: result.modifiedCount || 0,
        message: `Updated ${result.modifiedCount || 0} record(s) to site name "${normalizedSiteName}"`,
        siteName: normalizedSiteName,
        filter: filter,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Update failed: ${error.message}`,
        error: error.message,
      };
    }
  }

  /**
   * POST /weather/admin/count-by-site
   * Get count of records grouped by site name
   */
  @Post('count-by-site')
  @HttpCode(HttpStatus.OK)
  async countBySite() {
    try {
      const results = await this.weatherModel
        .aggregate([
          {
            $group: {
              _id: { $ifNull: ['$siteName', 'No Site Name'] },
              count: { $sum: 1 },
            },
          },
          {
            $sort: { count: -1 },
          },
        ])
        .exec();

      const total = await this.weatherModel.countDocuments().exec();

      return {
        success: true,
        total,
        bySite: results.map((r) => ({
          siteName: r._id,
          count: r.count,
        })),
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Count failed: ${error.message}`,
      };
    }
  }
}
