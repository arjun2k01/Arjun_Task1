import { IsNotEmpty, IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';

export class CreateWeatherDto {
  @IsOptional()
  @IsString()
  siteName?: string;

  @IsNotEmpty()
  date: string;

  @IsNotEmpty()
  time: string;

  @IsNumber()
  @Min(0)
  @Max(1500)
  poa: number;

  @IsNumber()
  @Min(0)
  @Max(1500)
  ghi: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1500)
  albedoUp?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1500)
  albedoDown?: number;

  @IsNumber()
  @Min(0)
  moduleTemp: number;

  @IsNumber()
  @Min(0)
  ambientTemp: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  windSpeed?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  rainfall?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  humidity?: number;
}
