import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WeatherModule } from '../weather/weather.module';  // Import WeatherModule
import { MeterExcelService } from './meter-excel.service';  // Import MeterExcelService
import { Meter, MeterSchema } from './meter.schema';
import { MeterController } from './meter.controller';
import { MeterUploadController } from './meter-upload.controller';
import { MeterValidateController } from './meter-validate.controller';
import { MeterSubmitController } from './meter-submit.controller';
import { MeterTemplateController } from './meter-template.controller';
import { MeterSyncController } from './meter-sync.controller';
import { MeterService } from './meter.service';
import { MeterUploadService } from './meter-upload.service';
import { MeterValidateService } from './meter-validate.service';
import { MeterSubmitService } from './meter-submit.service';
import { MeterSyncService } from './meter-sync.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Meter.name, schema: MeterSchema }]),
    WeatherModule,  // Import WeatherModule to use WeatherService
  ],
  controllers: [
    MeterController,
    MeterUploadController,
    MeterValidateController,
    MeterSubmitController,
    MeterTemplateController,
    MeterSyncController,
  ],
  providers: [
    MeterService,
    MeterUploadService,
    MeterValidateService,
    MeterSubmitService,
    MeterSyncService,
    MeterExcelService,  // Register MeterExcelService as a provider
  ],
  exports: [MeterService, MeterSubmitService, MeterSyncService],
})
export class MeterModule {}
