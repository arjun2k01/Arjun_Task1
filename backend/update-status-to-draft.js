/**
 * Migration Script: Update status from 'okay' to 'draft'
 *
 * This script updates all existing records with status='okay' to status='draft'
 *
 * Run this script once using: node update-status-to-draft.js
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

    // Update Weather collection: change 'okay' to 'draft'
    const weatherResult = await db.collection('weathers').updateMany(
      { status: 'okay' }, // Only update records with status = 'okay'
      { $set: { status: 'draft' } }
    );

    console.log(`✅ Weather Collection: Updated ${weatherResult.modifiedCount} records from 'okay' to 'draft'`);

    // Update Meter collection: change 'okay' to 'draft'
    const meterResult = await db.collection('meters').updateMany(
      { status: 'okay' }, // Only update records with status = 'okay'
      { $set: { status: 'draft' } }
    );

    console.log(`✅ Meter Collection: Updated ${meterResult.modifiedCount} records from 'okay' to 'draft'`);

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
