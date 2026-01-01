import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { WeatherModule } from './weather/weather.module';
import { MeterModule } from './meter/meter.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    MongooseModule.forRoot(
      'mongodb+srv://inverterOP:inverterOP@cluster0.pnxrna2.mongodb.net/unified_energy_management?retryWrites=true&w=majority&appName=Cluster0',
    ),
    HealthModule,
    WeatherModule,
    MeterModule,
  ],
})
export class AppModule {}
