import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import * as XLSX from 'xlsx';

@Controller('weather/template')
export class WeatherTemplateController {
  @Get()
  downloadTemplate(
    @Res({ passthrough: false }) res: Response,
  ) {
    const headers = [
      'Date',
      'Time',
      'Site Name',
      'POA',
      'GHI',
      'AlbedoUp',
      'AlbedoDown',
      'ModuleTemp',
      'AmbientTemp',
      'WindSpeed',
      'Rainfall',
      'Humidity',
    ];

    const sampleRow = {
      Date: '01-01-2025',
      Time: '10:00',
      'Site Name': 'Site A',
      POA: 500,
      GHI: 600,
      AlbedoUp: 50,
      AlbedoDown: 40,
      ModuleTemp: 45,
      AmbientTemp: 30,
      WindSpeed: 5,
      Rainfall: 0,
      Humidity: 60,
    };

    const worksheet = XLSX.utils.json_to_sheet([sampleRow], {
      header: headers,
    });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'WeatherTemplate');

    const buffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    });

    res.set({
      'Content-Disposition': 'attachment; filename=weather_template.xlsx',
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    res.end(buffer);
  }
}
