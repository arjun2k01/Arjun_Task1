# Status Field Migration Instructions

## What This Does
This migration script adds `status: 'okay'` to all existing Weather and Meter records in your database.

## Prerequisites
- Node.js installed
- MongoDB running
- Mongoose package installed

## Steps to Run Migration

### Step 1: Update MongoDB Connection String
Open `update-status-migration.js` and update the connection string on line 11:

```javascript
const MONGO_URI = 'mongodb://localhost:27017/weathermeter';
```

Replace with your actual MongoDB connection string. For example:
- Local: `mongodb://localhost:27017/your-database-name`
- Atlas: `mongodb+srv://username:password@cluster.mongodb.net/database-name`

### Step 2: Run the Migration Script

Open terminal in the `backend` folder and run:

```bash
node update-status-migration.js
```

### Expected Output:
```
✅ Connected to MongoDB
✅ Weather Collection: Updated X records
✅ Meter Collection: Updated X records

🎉 Migration completed successfully!
✅ Disconnected from MongoDB
```

### Step 3: Verify
1. Refresh your Weather Data page - you should now see "okay" in the Status column
2. Refresh your Meter Data page - you should now see "okay" in the Status column

## Alternative: Manual Update via MongoDB Compass

If you prefer using MongoDB Compass GUI:

1. Open MongoDB Compass and connect to your database
2. Navigate to the `weathers` collection
3. Click "Add Data" → "Insert Document"
4. Run this update query in the shell:
   ```javascript
   db.weathers.updateMany(
     { status: { $exists: false } },
     { $set: { status: "okay" } }
   )
   ```
5. Repeat for `meters` collection:
   ```javascript
   db.meters.updateMany(
     { status: { $exists: false } },
     { $set: { status: "okay" } }
   )
   ```

## Notes
- This script only updates records that don't have a status field
- Records that already have a status field will not be modified
- The script is safe to run multiple times
- Always backup your database before running migrations in production
