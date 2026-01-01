/**
 * Migration Script: Add status field to existing Weather and Meter records
 *
 * This script updates all existing records in the database to have status = 'okay'
 *
 * Run this script once using: node update-status-migration.js
 */

const mongoose = require('mongoose');

// MongoDB connection string
const MONGO_URI = 'mongodb+srv://weatherMeter:WeatherOP@cluster0.f6x7db8.mongodb.net/?appName=Cluster0';

async function migrateData() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;

    // Update Weather collection
    const weatherResult = await db.collection('weathers').updateMany(
      { status: { $exists: false } }, // Only update records without status field
      { $set: { status: 'okay' } }
    );

    console.log(`✅ Weather Collection: Updated ${weatherResult.modifiedCount} records`);

    // Update Meter collection
    const meterResult = await db.collection('meters').updateMany(
      { status: { $exists: false } }, // Only update records without status field
      { $set: { status: 'okay' } }
    );

    console.log(`✅ Meter Collection: Updated ${meterResult.modifiedCount} records`);

    console.log('\n🎉 Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

// Run the migration
migrateData();
