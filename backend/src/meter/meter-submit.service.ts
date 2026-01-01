import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Meter, MeterDocument } from './meter.schema';
import { WeatherService } from '../weather/weather.service';  // Importing WeatherService

// Helper functions for time calculations
function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function minutesToHHMM(total: number): string {
  const t = ((total % 1440) + 1440) % 1440;
  const hh = String(Math.floor(t / 60)).padStart(2, '0');
  const mm = String(t % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function diffHHMM(start: string, stop: string): string {
  const s = timeToMinutes(start);
  const e = timeToMinutes(stop);
  const diff = e >= s ? (e - s) : (1440 - s + e); // overnight safe
  return minutesToHHMM(diff);
}

function normalizeHHMM(v: any): string | null {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v).trim();

  // HH:MM:SS -> HH:MM
  const m2 = s.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if (m2) return `${String(Number(m2[1])).padStart(2, '0')}:${m2[2]}`;

  // H:MM or HH:MM -> HH:MM
  const m1 = s.match(/^(\d{1,2}):(\d{2})$/);
  if (m1) return `${String(Number(m1[1])).padStart(2, '0')}:${m1[2]}`;

  return s;
}

function isValidHHMM(v: any): boolean {
  if (typeof v !== 'string') return false;
  const m = v.trim().match(/^(\d{2}):(\d{2})$/);
  if (!m) return false;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  return hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59;
}

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

      // Normalize weather data points
      const points = weatherData
        .map((w: any) => {
          const tRaw = w?.time ?? w?.Time ?? '';
          const t = normalizeHHMM(String(tRaw));
          const poa = Number(w?.poa ?? w?.POA ?? w?.['POA Meter 1'] ?? w?.['POA_Meter_1']);

          return {
            time: t ? String(t).slice(0, 5) : '',
            poa: Number.isFinite(poa) ? poa : NaN,
          };
        })
        .filter((p) => isValidHHMM(p.time) && Number.isFinite(p.poa))
        .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));

      // 1) Plant Start Time: first time POA >= 10
      let plantStartTime = '00:00';
      const first10 = points.find((p) => p.poa >= 10);
      if (first10) plantStartTime = first10.time;

      // 2) Plant Stop Time: last time POA > 0 and < 50; fallback: last POA > 0
      let plantStopTime = '00:00';
      const lastBetween = [...points].reverse().find((p) => p.poa > 0 && p.poa < 50);
      if (lastBetween) {
        plantStopTime = lastBetween.time;
      } else {
        const lastPos = [...points].reverse().find((p) => p.poa > 0);
        if (lastPos) plantStopTime = lastPos.time;
      }

      // 3) Total = Stop - Start (overnight supported)
      const total =
        isValidHHMM(plantStartTime) && isValidHHMM(plantStopTime)
          ? diffHHMM(plantStartTime, plantStopTime)
          : '00:00';

      // 4) Get calculated GSS Export Total from validated/enriched row
      // This is the daily generation value calculated during validation
      const gssExportTotal = this.num(r?.['GSS Export Total']) ?? 0;

      const doc: Partial<Meter> = {
        date,
        time,
        plantStartTime,  // Calculated Plant Start Time
        plantStopTime,   // Calculated Plant Stop Time
        total,           // Calculated Total operation time
        activeEnergyImport: this.num(r?.ActiveEnergyImport ?? r?.activeEnergyImport) ?? 0,
        activeEnergyExport: gssExportTotal,  // Use GSS Export Total as the primary export value
        reactiveEnergyImport: this.num(r?.ReactiveEnergyImport ?? r?.reactiveEnergyImport) ?? 0,
        reactiveEnergyExport: this.num(r?.ReactiveEnergyExport ?? r?.reactiveEnergyExport) ?? 0,
        voltage: this.num(r?.Voltage ?? r?.voltage) ?? 0,
        current: this.num(r?.Current ?? r?.current) ?? 0,
        frequency: this.num(r?.Frequency ?? r?.frequency) ?? 0,
        powerFactor: this.num(r?.PowerFactor ?? r?.powerFactor) ?? 0,
        status: r?.status ?? r?.Status ?? 'draft',
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
