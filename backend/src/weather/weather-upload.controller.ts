import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { WeatherExcelService } from './weather-excel.service';
import { WeatherValidateService } from './weather-validate.service';

@Controller('weather')
export class WeatherUploadController {
  constructor(
    private readonly excelService: WeatherExcelService,
    private readonly validateService: WeatherValidateService,
  ) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadWeatherExcel(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Excel file is required');
    }

    // Parse the Excel file to get all rows
    const parsedRows = await this.excelService.parseExcel(file.buffer);

    // Validate all rows
    const validationResult = this.validateService.validateRows(parsedRows);

    // Return all rows (for preview) along with validation errors
    return {
      rows: parsedRows,
      errors: validationResult.errors,
      isValid: validationResult.isValid,
    };
  }
}