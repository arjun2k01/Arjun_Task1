import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MeterDocument = Meter & Document;

@Schema({ timestamps: true })
export class Meter {
  @Prop({ required: true })
  date: string;

  @Prop({ required: true })
  time: string;
  
  @Prop({ required: true })
  plantStartTime: string;  // Plant Start Time, will be calculated

  @Prop({ default: '00:00' })
  plantStopTime: string;  // Plant Stop Time, will be calculated

  @Prop({ default: '00:00' })
  total: string;  // Total operation time (Stop - Start)

  @Prop({ default: 0 })
  activeEnergyImport: number;

  @Prop({ default: 0 })
  activeEnergyExport: number;

  @Prop({ default: 0 })
  reactiveEnergyImport: number;

  @Prop({ default: 0 })
  reactiveEnergyExport: number;

  @Prop({ default: 0 })
  voltage: number;

  @Prop({ default: 0 })
  current: number;

  @Prop({ default: 0 })
  frequency: number;

  @Prop({ default: 0 })
  powerFactor: number;

  @Prop({ default: 'draft' })
  status: string;
}

export const MeterSchema = SchemaFactory.createForClass(Meter);

// Prevent duplicate entries for the same date+time
MeterSchema.index({ date: 1, time: 1 }, { unique: true });
