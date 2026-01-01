import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Meter, MeterDocument } from './meter.schema';
import { WeatherService } from '../weather/weather.service';

interface FindAllOptions {
  startDate?: string;
  endDate?: string;
  limit?: number;
  skip?: number;
}

export interface WeatherData {
  poa: number | null;
  ghi: number | null;
  moduleTemp: number | null;
  ambientTemp: number | null;
  windSpeed: number | null;
  rainfall: number | null;
  humidity: number | null;
}

export interface MeterWithWeather extends Meter {
  startTime: string;
  endTime: string;
  weatherData: WeatherData | null;
}

@Injectable()
export class MeterService {
  constructor(
    @InjectModel(Meter.name)
    private readonly meterModel: Model<MeterDocument>,
    private readonly weatherService: WeatherService,
  ) { }

  // CREATE
  async create(createMeterDto: Record<string, any>): Promise<Meter> {
    const date = String(createMeterDto?.date ?? createMeterDto?.Date ?? '').trim();
    const time = String(createMeterDto?.time ?? createMeterDto?.Time ?? '00:00').trim();

    if (!date) {
      throw new BadRequestException('Date is required');
    }

    try {
      const doc = new this.meterModel({
        date,
        time,
        activeEnergyImport: this.toNumber(createMeterDto?.activeEnergyImport ?? createMeterDto?.ActiveEnergyImport) ?? 0,
        activeEnergyExport: this.toNumber(createMeterDto?.activeEnergyExport ?? createMeterDto?.ActiveEnergyExport) ?? 0,
        reactiveEnergyImport: this.toNumber(createMeterDto?.reactiveEnergyImport ?? createMeterDto?.ReactiveEnergyImport) ?? 0,
        reactiveEnergyExport: this.toNumber(createMeterDto?.reactiveEnergyExport ?? createMeterDto?.ReactiveEnergyExport) ?? 0,
        voltage: this.toNumber(createMeterDto?.voltage ?? createMeterDto?.Voltage) ?? 0,
        current: this.toNumber(createMeterDto?.current ?? createMeterDto?.Current) ?? 0,
        frequency: this.toNumber(createMeterDto?.frequency ?? createMeterDto?.Frequency) ?? 0,
        powerFactor: this.toNumber(createMeterDto?.powerFactor ?? createMeterDto?.PowerFactor) ?? 0,
      });

      return await doc.save();
    } catch (error: any) {
      if (error.code === 11000) {
        throw new ConflictException('Meter record already exists for this date and time');
      }
      throw error;
    }
  }

  // READ ALL with filters - includes correlated weather data
  async findAll(options: FindAllOptions | Record<string, any> = {}): Promise<any> {
    // Support both FindAllOptions and direct query object
    let filter: Record<string, any> = {};
    let limit = 100;
    let skip = 0;

    if ('startDate' in options || 'endDate' in options || 'limit' in options || 'skip' in options) {
      // Using FindAllOptions format
      const { startDate, endDate, limit: optLimit = 100, skip: optSkip = 0 } = options as FindAllOptions;
      limit = optLimit;
      skip = optSkip;

      if (startDate || endDate) {
        filter.date = {};
        if (startDate) filter.date.$gte = startDate;
        if (endDate) filter.date.$lte = endDate;
      }
    } else {
      // Using direct query object (for sync service)
      filter = options;
    }

    const [meterData, total] = await Promise.all([
      this.meterModel
        .find(filter)
        .sort({ date: -1, time: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.meterModel.countDocuments(filter).exec(),
    ]);

    // Get unique dates and batch fetch weather data
    const uniqueDates = Array.from(new Set(meterData.map((m) => m.date)));
    const weatherByDate = new Map<string, any[]>();

    // Batch fetch all weather data for unique dates
    for (const date of uniqueDates) {
      try {
        const weatherRecords = await this.weatherService.getWeatherByDate(date);
        weatherByDate.set(date, weatherRecords || []);
      } catch {
        weatherByDate.set(date, []);
      }
    }

    // Enrich meter data with weather correlation
    const enrichedData: MeterWithWeather[] = meterData.map((meter) => {
      const weatherRecords = weatherByDate.get(meter.date) || [];

      // Calculate Plant Start Time: First time when POA >= 10 W/m²
      const startTime = this.calculatePlantStartTime(weatherRecords);

      // Calculate Plant Stop Time: Last time when POA > 0 and < 50 W/m²
      const endTime = this.calculatePlantStopTime(weatherRecords);

      // Get weather data for current meter time
      const weatherData = this.extractWeatherData(weatherRecords, meter.time);

      return {
        ...meter,
        startTime,
        endTime,
        weatherData,
      } as MeterWithWeather;
    });

    return { data: enrichedData, total };
  }

  // Helper: Calculate Plant Start Time - first time when POA >= 10 W/m²
  private calculatePlantStartTime(weatherRecords: any[]): string {
    if (!weatherRecords || weatherRecords.length === 0) {
      return '00:00';
    }

    // Sort by time ascending
    const sorted = [...weatherRecords].sort((a, b) => {
      const timeA = a.time || a.Time || '00:00';
      const timeB = b.time || b.Time || '00:00';
      return timeA.localeCompare(timeB);
    });

    // Find first time when POA >= 10
    for (const record of sorted) {
      const poa = Number(record.poa ?? record.POA ?? 0);
      if (poa >= 10) {
        return record.time || record.Time || '00:00';
      }
    }

    return '00:00';
  }

  // Helper: Calculate Plant Stop Time - last time when POA > 0 and < 50 W/m²
  private calculatePlantStopTime(weatherRecords: any[]): string {
    if (!weatherRecords || weatherRecords.length === 0) {
      return '00:00';
    }

    // Sort by time descending
    const sorted = [...weatherRecords].sort((a, b) => {
      const timeA = a.time || a.Time || '00:00';
      const timeB = b.time || b.Time || '00:00';
      return timeB.localeCompare(timeA);
    });

    // Find last time when POA > 0 and < 50 (scanning from end)
    for (const record of sorted) {
      const poa = Number(record.poa ?? record.POA ?? 0);
      if (poa > 0 && poa < 50) {
        return record.time || record.Time || '00:00';
      }
    }

    // Fallback: last time when POA > 0
    for (const record of sorted) {
      const poa = Number(record.poa ?? record.POA ?? 0);
      if (poa > 0) {
        return record.time || record.Time || '00:00';
      }
    }

    return '00:00';
  }

  // Helper: Extract weather data for specific time
  private extractWeatherData(weatherRecords: any[], time: string): WeatherData | null {
    if (!weatherRecords || weatherRecords.length === 0) {
      return null;
    }

    // Try to find exact time match first
    const exactMatch = weatherRecords.find(
      (w) => (w.time || w.Time) === time
    );
    const weather = exactMatch || weatherRecords[0];

    if (!weather) {
      return null;
    }

    return {
      poa: weather.poa ?? weather.POA ?? null,
      ghi: weather.ghi ?? weather.GHI ?? null,
      moduleTemp: weather.moduleTemp ?? weather.ModuleTemp ?? null,
      ambientTemp: weather.ambientTemp ?? weather.AmbientTemp ?? null,
      windSpeed: weather.windSpeed ?? weather.WindSpeed ?? null,
      rainfall: weather.rainfall ?? weather.Rainfall ?? null,
      humidity: weather.humidity ?? weather.Humidity ?? null,
    };
  }


  // READ ONE by ID
  async findOne(id: string): Promise<Meter | null> {
    try {
      return await this.meterModel.findById(id).lean().exec();
    } catch {
      return null;
    }
  }

  // READ by date
  async findByDate(date: string): Promise<Meter[]> {
    return this.meterModel
      .find({ date })
      .sort({ time: 1 })
      .lean()
      .exec();
  }

  // UPDATE
  async update(id: string, updateMeterDto: Record<string, any>): Promise<Meter | null> {
    try {
      const updateData: Partial<Meter> = {};

      if (updateMeterDto.date !== undefined) updateData.date = String(updateMeterDto.date).trim();
      if (updateMeterDto.time !== undefined) updateData.time = String(updateMeterDto.time).trim();
      if (updateMeterDto.activeEnergyImport !== undefined) updateData.activeEnergyImport = this.toNumber(updateMeterDto.activeEnergyImport) ?? 0;
      if (updateMeterDto.activeEnergyExport !== undefined) updateData.activeEnergyExport = this.toNumber(updateMeterDto.activeEnergyExport) ?? 0;
      if (updateMeterDto.reactiveEnergyImport !== undefined) updateData.reactiveEnergyImport = this.toNumber(updateMeterDto.reactiveEnergyImport) ?? 0;
      if (updateMeterDto.reactiveEnergyExport !== undefined) updateData.reactiveEnergyExport = this.toNumber(updateMeterDto.reactiveEnergyExport) ?? 0;
      if (updateMeterDto.voltage !== undefined) updateData.voltage = this.toNumber(updateMeterDto.voltage) ?? 0;
      if (updateMeterDto.current !== undefined) updateData.current = this.toNumber(updateMeterDto.current) ?? 0;
      if (updateMeterDto.frequency !== undefined) updateData.frequency = this.toNumber(updateMeterDto.frequency) ?? 0;
      if (updateMeterDto.powerFactor !== undefined) updateData.powerFactor = this.toNumber(updateMeterDto.powerFactor) ?? 0;

      const updated = await this.meterModel
        .findByIdAndUpdate(id, { $set: updateData }, { new: true })
        .lean()
        .exec();

      return updated;
    } catch (error: any) {
      if (error.code === 11000) {
        throw new ConflictException('Duplicate date and time not allowed');
      }
      return null;
    }
  }

  // DELETE ONE
  async remove(id: string): Promise<Meter | null> {
    try {
      return await this.meterModel.findByIdAndDelete(id).lean().exec();
    } catch {
      return null;
    }
  }

  // DELETE MANY
  async removeMany(ids: string[]): Promise<{ deletedCount: number }> {
    const result = await this.meterModel.deleteMany({ _id: { $in: ids } }).exec();
    return { deletedCount: result.deletedCount ?? 0 };
  }

  // COUNT documents with filter
  async count(filter: Record<string, any> = {}): Promise<number> {
    return this.meterModel.countDocuments(filter).exec();
  }

  private toNumber(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
}