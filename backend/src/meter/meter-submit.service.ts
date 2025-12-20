import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Meter, MeterDocument } from './meter.schema';
import { WeatherService } from '../weather/weather.service';  // Importing WeatherService

@Injectable()
export class MeterSubmitService {
  constructor(
    @InjectModel(Meter.name) private readonly meterModel: Model<MeterDocument>,
    private readonly weatherService: WeatherService,  // Inject WeatherService
  ) { }

  async submitRows(rows: Record<string, any>[]) {
    if (!Array.isArray(rows)) {
      throw new BadRequestException('rows must be an array');
    }

    // OPTIMIZATION: Batch fetch all weather data in parallel
    const uniqueDates = Array.from(
      new Set(rows.map((r) => String(r?.Date ?? r?.date ?? '').trim()).filter(Boolean))
    );

    const weatherByDate = new Map<string, any[]>();
    if (uniqueDates.length > 0) {
      // Fetch all weather for all dates in parallel using Promise.all
      const weatherPromises = uniqueDates.map(async (date) => {
        const weatherData = await this.weatherService.getWeatherByDate(date);
        return { date, weatherData: weatherData || [] };
      });

      const results = await Promise.all(weatherPromises);
      for (const { date, weatherData } of results) {
        weatherByDate.set(date, weatherData);
      }
    }

    const ops = rows.map((r) => {
      const date = String(r?.Date ?? r?.date ?? '').trim();
      const time = String(r?.Time ?? r?.time ?? '00:00').trim();

      if (!date) {
        throw new BadRequestException('Each row must contain Date');
      }

      // Get pre-fetched weather data
      const weatherData = weatherByDate.get(date) || [];

      let plantStartTime = '00:00'; // Default value
      for (const weatherRow of weatherData) {
        if (weatherRow.poa >= 10) {
          plantStartTime = weatherRow.time;  // First time POA >= 10 W/m²
          break;
        }
      }

      const doc: Partial<Meter> = {
        date,
        time,
        plantStartTime,  // Add calculated Plant Start Time
        activeEnergyImport: this.num(r?.ActiveEnergyImport ?? r?.activeEnergyImport) ?? 0,
        activeEnergyExport: this.num(r?.ActiveEnergyExport ?? r?.activeEnergyExport) ?? 0,
        // Other fields...
      };

      return {
        updateOne: {
          filter: { date: doc.date, time: doc.time },
          update: { $set: doc },
          upsert: true,
        },
      };
    });

    const result = await this.meterModel.bulkWrite(ops, { ordered: false });

    return {
      insertedCount: result.insertedCount ?? 0,
      matchedCount: result.matchedCount ?? 0,
      modifiedCount: result.modifiedCount ?? 0,
      upsertedCount: result.upsertedCount ?? 0,
    };
  }

  private num(v: any): number | null {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
}
