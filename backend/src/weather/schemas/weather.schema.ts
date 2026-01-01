import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type WeatherDocument = Weather & Document;

@Schema({ timestamps: true })
export class Weather {
  @Prop()
  siteName?: string;

  @Prop({ required: true })
  date: string; // DD-MMM-YY

  @Prop({ required: true })
  time: string; // HH:MM

  @Prop({ required: true, min: 0, max: 1500 })
  poa: number;

  @Prop({ required: true, min: 0, max: 1500 })
  ghi: number;

  @Prop({ min: 0, max: 1500 })
  albedoUp?: number;

  @Prop({ min: 0, max: 1500 })
  albedoDown?: number;

  @Prop({ required: true, min: 0 })
  moduleTemp: number; // cannot be 0 (validated in service)

  @Prop({ required: true, min: 0 })
  ambientTemp: number;

  @Prop({ min: 0 })
  windSpeed?: number;

  @Prop({ min: 0 })
  rainfall?: number;

  @Prop({ min: 0 })
  humidity?: number;

  @Prop({ default: 'draft' })
  status: string;
}

export const WeatherSchema = SchemaFactory.createForClass(Weather);

// Prevent duplicate date + time entries
WeatherSchema.index({ date: 1, time: 1 }, { unique: true });
