import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Weather, WeatherDocument } from './schemas/weather.schema';

@Injectable()
export class WeatherService {
  constructor(@InjectModel(Weather.name) private weatherModel: Model<WeatherDocument>) { }

  async create(createWeatherDto: any) {
    const createdWeather = new this.weatherModel(createWeatherDto);
    return await createdWeather.save();
  }

  async findAllWithFilters(filters: any) {
    const { limit, skip, ...queryFilters } = filters;

    const query = this.weatherModel.find(queryFilters);

    if (skip) {
      query.skip(skip);
    }

    if (limit) {
      query.limit(limit);
    }

    const data = await query.exec();
    const total = await this.weatherModel.countDocuments(queryFilters).exec();

    return { data, total };
  }

  async findOne(id: string) {
    return this.weatherModel.findById(id).exec();
  }

  async findByDate(date: string) {
    return this.weatherModel.find({ date }).exec();
  }

  // This is the new method - handles multiple date formats
  async getWeatherByDate(date: string) {
    // Get all possible date format variations to search for
    const dateVariations = this.getDateVariations(date);

    const weatherData = await this.weatherModel.find({
      $or: dateVariations.flatMap(d => [
        { date: d },
        { Date: d },
      ]),
    }).lean().exec();

    return weatherData;
  }

  // Generate all possible date format variations for a given date
  private getDateVariations(date: string): string[] {
    const variations: string[] = [date]; // Always include original
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Try to parse DD-MM-YYYY format (meter format)
    const ddmmyyyyMatch = date.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (ddmmyyyyMatch) {
      const [, day, month, year] = ddmmyyyyMatch;
      const monthIndex = parseInt(month, 10) - 1;
      if (monthIndex >= 0 && monthIndex < 12) {
        // Convert to DD-MMM-YY (weather format)
        const monthName = MONTHS[monthIndex];
        const shortYear = year.slice(-2);
        variations.push(`${day}-${monthName}-${shortYear}`);
        // Also add ISO format YYYY-MM-DD
        variations.push(`${year}-${month}-${day}`);
      }
    }

    // Try to parse DD-MMM-YY format (weather format)
    const ddmmmyyMatch = date.match(/^(\d{2})-([A-Za-z]{3})-(\d{2})$/);
    if (ddmmmyyMatch) {
      const [, day, monthName, shortYear] = ddmmmyyMatch;
      const monthIndex = MONTHS.findIndex(m => m.toLowerCase() === monthName.toLowerCase());
      if (monthIndex >= 0) {
        const fullYear = `20${shortYear}`;
        const month = String(monthIndex + 1).padStart(2, '0');
        // Convert to DD-MM-YYYY (meter format)
        variations.push(`${day}-${month}-${fullYear}`);
        // Also add ISO format YYYY-MM-DD
        variations.push(`${fullYear}-${month}-${day}`);
      }
    }

    // Remove duplicates
    return [...new Set(variations)];
  }

  async update(id: string, updateWeatherDto: any) {
    return this.weatherModel.findByIdAndUpdate(id, updateWeatherDto, { new: true }).exec();
  }

  async remove(id: string) {
    return this.weatherModel.findByIdAndDelete(id).exec();
  }

  async removeMany(ids: string[]) {
    return this.weatherModel.deleteMany({ _id: { $in: ids } }).exec();
  }
}
