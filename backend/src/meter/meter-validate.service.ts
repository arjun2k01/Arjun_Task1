import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';

type RowError = { rowNumber: number; errors: string[] };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function isValidDDMMYYYY(v: any) {
  return typeof v === 'string' && /^\d{2}-\d{2}-\d{4}$/.test(v.trim());
}

function isValidHHMM(v: any) {
  if (typeof v !== 'string') return false;
  const m = v.trim().match(/^(\d{2}):(\d{2})$/);
  if (!m) return false;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  return hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59;
}

function normalizeHHMM(v: any): string | null {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v).trim();

  // HH:MM:SS -> HH:MM
  const m2 = s.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if (m2) return `${pad2(Number(m2[1]))}:${m2[2]}`;

  // H:MM or HH:MM -> HH:MM
  const m1 = s.match(/^(\d{1,2}):(\d{2})$/);
  if (m1) return `${pad2(Number(m1[1]))}:${m1[2]}`;

  return s;
}

function ddmmyyyyToISO(ddmmyyyy: string) {
  const [dd, mm, yyyy] = ddmmyyyy.split('-');
  return `${yyyy}-${mm}-${dd}`; // YYYY-MM-DD
}

function ddmmyyyyToDDMMMYY(ddmmyyyy: string) {
  const [dd, mm, yyyy] = ddmmyyyy.split('-');
  const mi = Number(mm);
  if (!mi || mi < 1 || mi > 12) return ddmmyyyy;
  const mon = MONTHS[mi - 1];
  const yy = String(yyyy).slice(-2);
  return `${dd}-${mon}-${yy}`; // DD-MMM-YY
}

function timeToMinutes(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function minutesToHHMM(total: number) {
  const t = ((total % 1440) + 1440) % 1440;
  const hh = String(Math.floor(t / 60)).padStart(2, '0');
  const mm = String(t % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function diffHHMM(start: string, stop: string) {
  const s = timeToMinutes(start);
  const e = timeToMinutes(stop);
  const diff = e >= s ? (e - s) : (1440 - s + e); // overnight safe
  return minutesToHHMM(diff);
}

function toNumberOrNull(v: any) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

@Injectable()
export class MeterValidateService {
  private weatherModel: Model<any> | null = null;

  constructor(@InjectConnection() private readonly connection: Connection) { }

  private getWeatherModel(): Model<any> {
    if (this.weatherModel) return this.weatherModel;

    const model = this.connection.models?.['Weather'];
    if (!model) {
      throw new BadRequestException(
        'Weather model not found. Ensure WeatherModule is loaded and registers Weather schema.',
      );
    }

    this.weatherModel = model;
    return model;
  }

  async validateRows(rows: Record<string, any>[]) {
    if (!Array.isArray(rows)) throw new BadRequestException('rows must be an array');

    const errors: RowError[] = [];
    const seenDates = new Set<string>();

    // Preload weather data per date (performance)
    const uniqueDates = Array.from(
      new Set(
        rows
          .map((r) => (typeof r?.['Date'] === 'string' ? r['Date'].trim() : ''))
          .filter((d) => d && isValidDDMMYYYY(d)),
      ),
    );

    const Weather = this.getWeatherModel();
    const weatherByDate = new Map<string, any[]>();

    // OPTIMIZATION: Batch fetch all weather data in a single query instead of per-date queries
    if (uniqueDates.length > 0) {
      const dateConditions = uniqueDates.flatMap((d) => {
        const iso = ddmmyyyyToISO(d);
        const ddmmyy = ddmmyyyyToDDMMMYY(d);
        return [
          { Date: iso },
          { Date: ddmmyy },
          { date: iso },
          { date: ddmmyy },
        ];
      });

      const allWeatherRows = await Weather.find({ $or: dateConditions })
        .lean()
        .exec();

      // Group weather rows by date
      for (const w of allWeatherRows) {
        const dateVal = w.Date || w.date || '';
        // Find which uniqueDate this matches
        for (const d of uniqueDates) {
          const iso = ddmmyyyyToISO(d);
          const ddmmyy = ddmmyyyyToDDMMMYY(d);
          if (dateVal === iso || dateVal === ddmmyy) {
            if (!weatherByDate.has(d)) {
              weatherByDate.set(d, []);
            }
            weatherByDate.get(d)!.push(w);
            break;
          }
        }
      }
    }

    const enrichedRows = rows.map((row, index) => {
      const rowNumber = index + 2; // UI excel-like
      const rowErrors: string[] = [];

      // -------- 1) Date format + no duplicates --------
      const dateRaw = row?.['Date'];
      const date = typeof dateRaw === 'string' ? dateRaw.trim() : String(dateRaw ?? '').trim();

      if (!date || !isValidDDMMYYYY(date)) {
        rowErrors.push('Date must be in format DD-MM-YYYY (e.g., 01-12-2024)');
      } else {
        if (seenDates.has(date)) rowErrors.push('No duplicate dates allowed');
        seenDates.add(date);
      }

      // -------- 2) Time format validation (if present) --------
      const startTimeUser = normalizeHHMM(row?.['Start Time'] ?? row?.['StartTime'] ?? row?.['Start']);
      const stopTimeUser = normalizeHHMM(row?.['Stop Time'] ?? row?.['StopTime'] ?? row?.['Stop']);

      if (startTimeUser && !isValidHHMM(startTimeUser)) rowErrors.push('Start Time must be HH:MM (24-hour)');
      if (stopTimeUser && !isValidHHMM(stopTimeUser)) rowErrors.push('Stop Time must be HH:MM (24-hour)');

      const hasStartStop =
        !!startTimeUser &&
        !!stopTimeUser &&
        isValidHHMM(startTimeUser) &&
        isValidHHMM(stopTimeUser);

      // -------- 3/4) Export/Import readings rules --------
      const keys = Object.keys(row ?? {});
      const readingKeys = keys.filter((k) => /export|import/i.test(k));

      let hasAnyReading = false;

      for (const k of readingKeys) {
        const n = toNumberOrNull(row[k]);
        if (n === null) continue;

        if (Number.isNaN(n)) {
          rowErrors.push(`${k} must be numeric`);
        } else {
          hasAnyReading = true;
          if (n < 0) rowErrors.push(`${k} cannot be negative`);
        }
      }

      if (!hasStartStop && !hasAnyReading) {
        rowErrors.push('Each date must have either Start/Stop times OR Export/Import readings');
      }

      // -------- Auto-calculated fields (mandatory) --------
      let plantStartTime = '00:00';
      let plantStopTime = '00:00';

      if (date && isValidDDMMYYYY(date)) {
        const w = weatherByDate.get(date) || [];

        // normalize weather points: HH:MM + POA number
        const points = w
          .map((x: any) => {
            const tRaw = x?.Time ?? x?.time ?? '';
            const t = normalizeHHMM(String(tRaw));
            const poa = Number(
              x?.POA ??
              x?.poa ??
              x?.['POA Meter 1'] ??
              x?.['POA_Meter_1'],
            );

            return {
              time: t ? String(t).slice(0, 5) : '',
              poa: Number.isFinite(poa) ? poa : NaN,
            };
          })
          .filter((p) => isValidHHMM(p.time) && Number.isFinite(p.poa))
          .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));

        // 1) Plant Start Time: first time POA >= 10
        const first10 = points.find((p) => p.poa >= 10);
        if (first10) plantStartTime = first10.time;

        // 2) Plant Stop Time: last time POA >0 and <50; fallback: last POA >0
        const lastBetween = [...points].reverse().find((p) => p.poa > 0 && p.poa < 50);
        if (lastBetween) {
          plantStopTime = lastBetween.time;
        } else {
          const lastPos = [...points].reverse().find((p) => p.poa > 0);
          if (lastPos) plantStopTime = lastPos.time;
        }
      }

      // 3) Total = Stop - Start (overnight supported)
      const total =
        isValidHHMM(plantStartTime) && isValidHHMM(plantStopTime)
          ? diffHHMM(plantStartTime, plantStopTime)
          : '00:00';

      // 4/5) Export Total + Import Total (Final - Initial) for each meter
      // Flexible pairing based on your sheet headers.
      const computed: Record<string, any> = {};
      const exportTotals: { id: string; value: number }[] = [];
      const importTotals: { id: string; value: number }[] = [];

      const computePairs = (type: 'Export' | 'Import') => {
        const initialRegex = new RegExp(`^${type}\\s*(.*?)\\s*(Initial|Start)\\b`, 'i');
        const finalRegex = new RegExp(`^${type}\\s*(.*?)\\s*(Final|End)\\b`, 'i');

        const initials = new Map<string, string>();
        const finals = new Map<string, string>();

        for (const k of keys) {
          const mi = k.match(initialRegex);
          if (mi) initials.set((mi[1] || '').trim() || '1', k);

          const mf = k.match(finalRegex);
          if (mf) finals.set((mf[1] || '').trim() || '1', k);
        }

        for (const [id, ik] of initials.entries()) {
          const fk = finals.get(id);
          if (!fk) continue;

          const ini = toNumberOrNull(row[ik]);
          const fin = toNumberOrNull(row[fk]);

          if (ini === null || fin === null) continue;
          if (Number.isNaN(ini) || Number.isNaN(fin)) continue;

          const value = fin - ini;

          // Mandatory: readings cannot be negative; totals can be negative if data wrong
          // We do not block totals here; validation already blocks negative readings.
          const label = `${type} Total ${id}`.trim();
          computed[label] = value;

          if (type === 'Export') exportTotals.push({ id, value });
          else importTotals.push({ id, value });
        }
      };

      computePairs('Export');
      computePairs('Import');

      // 6/7/8) GSS totals + Net Export @GSS
      // If any meter id contains "GSS", sum only those; otherwise sum all totals.
      const hasGss =
        exportTotals.some((t) => /gss/i.test(t.id)) || importTotals.some((t) => /gss/i.test(t.id));

      const gssExportTotal = (hasGss ? exportTotals.filter((t) => /gss/i.test(t.id)) : exportTotals)
        .reduce((sum, t) => sum + (Number.isFinite(t.value) ? t.value : 0), 0);

      const gssImportTotal = (hasGss ? importTotals.filter((t) => /gss/i.test(t.id)) : importTotals)
        .reduce((sum, t) => sum + (Number.isFinite(t.value) ? t.value : 0), 0);

      const netExportAtGss = gssExportTotal - gssImportTotal;

      if (rowErrors.length) errors.push({ rowNumber, errors: rowErrors });

      return {
        ...row,

        // Auto-calculated daily fields
        'Plant Start Time': plantStartTime,
        'Plant Stop Time': plantStopTime,
        Total: total,

        // Per-meter totals (if pairs exist)
        ...computed,

        // Aggregates
        'GSS Export Total': gssExportTotal,
        'GSS Import Total': gssImportTotal,
        'Net Export @GSS': netExportAtGss,
      };
    });

    return {
      rows: enrichedRows,
      errors,
      isValid: errors.length === 0,
    };
  }
}
