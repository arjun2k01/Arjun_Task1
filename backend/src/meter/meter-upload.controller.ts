import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MeterExcelService } from './meter-excel.service';
import { MeterValidateService } from './meter-validate.service';

@Controller('meter')
export class MeterUploadController {
  constructor(
    private readonly excelService: MeterExcelService,
    private readonly validateService: MeterValidateService,
  ) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadMeterExcel(@UploadedFile() file: Express.Multer.File) {
    // Check if the file is provided
    if (!file) {
      throw new BadRequestException('Excel file is required');
    }

    try {
      // Parse the Excel file to get all rows
      const parsedRows = await this.excelService.parseExcel(file.buffer);

      // Validate all rows and get enriched data with auto-calculated fields
      const validationResult = await this.validateService.validateRows(parsedRows);

      // Return all rows (for preview) along with validation errors
      return {
        rows: validationResult.rows,
        errors: validationResult.errors,
        isValid: validationResult.isValid,
      };
    } catch (error) {
      console.error('[MeterUploadController] Error:', error);
      throw new BadRequestException('Error processing the Excel file: ' + (error as Error).message);
    }
  }
}