// meter-data.types.ts

export interface MeterData {
  date: string;
  startTime: string;
  stopTime: string;
  exportReading: number;
  importReading: number;
  poA: number;
  ghi: number;
  albedo: number;
  moduleTemperature: number;
  ambientTemperature: number;
  windSpeed: number;
  rainfall: number;
  humidity: number;
  plantStartTime?: string;
  plantStopTime?: string;
}

export interface RowErrorDto {
  rowNumber: number;
  errors: string[];
}
