    git clone <repository-url>
    cd weather-meter-management
    ```

2.  **Environment Setup**:
    Create a `.env` file in the root directory:
    ```env
    PORT=5000
    MONGODB_URI=your_mongodb_connection_string
    ```

3.  **Install Dependencies**:
    ```bash
    # Install root and backend dependencies
    npm install

    # Install frontend dependencies
    cd client && npm install
    ```

4.  **Run the Application**:
    ```bash
    # From the root directory to run both client and server
    npm run dev
    

## 🛠️ Tech Stack & Benefits

*   **Frontend**: React.js & Tailwind CSS – Delivers a responsive, intuitive interface for monitoring plant performance.
*   **Backend**: Node.js & Express – Handles high-concurrency bulk uploads and complex data correlation logic efficiently.
*   **Database**: MongoDB – Provides schema flexibility to accommodate varying data formats from different solar hardware.
*   **Validation**: Zod & ExcelJS – Ensures strict data integrity and high-speed parsing of raw Excel datasets.

**Why this stack?**
This combination provides the scalability needed for large-scale data ingestion and the flexibility to handle evolving data schemas without the overhead of traditional relational migrations.

> A high-performance full-stack application for managing solar plant data, validating complex datasets, and correlating energy production with environmental conditions.

## 📖 Overview

This system is designed to streamline the management of solar photovolatic (PV) plant data. It provides two core modules—**Weather** and **Meter**—to ingest raw Excel data, validate it against strict business rules, and persist it to a MongoDB database. 

A key feature is the **intelligent correlation engine**, which automatically calculates the *Plant Start Time* and *Plant Stop Time* for every meter reading by analyzing the corresponding solar irradiance (POA) data from the weather module.

## ✨ Key Features

### 🌦️ Weather Module
*   **Bulk Excel Upload**: Parse and validate thousands of weather records (POA, GHI, Temperature, Wind Speed) in seconds.
*   **Smart Validation**: Enforces integrity rules (e.g., `POA >= 0`, `Module Temp > 0`).
*   **Duplicate Handling**: Automatically detects and handles duplicate entries with "Upsert" logic.
*   **Date Normalization**: Seamlessly handles various date formats (`DD-MM-YYYY`, `DD-MMM-YY`, ISO).

### ⚡ Meter Data Module
*   **Automated Time Calculation**: Derives *Plant Start* and *Stop* times based on weather criteria, not just manual entry.
*   **Complex Aggregation**: Calculates Net Export, GSS Totals, and daily energy generation logic.
*   **Graceful Degradation**: System remains functional even if weather data is temporarily missing for a specific date.
*   **Batch Processing**: Optimized upload engine using parallel processing to handle large datasets (1000+ rows) efficiently.

---

## 🏗️ Technical Architecture

*   **Backend**: [NestJS](https://nestjs.com/) (Node.js)
    *   Modular architecture with Dependency Injection.
    *   `Mongoose` for MongoDB interactions.
    *   `Multer` for file handling.
*   **Frontend**: [React](https://reactjs.org/) + TypeScript
    *   Interactive Data Tables with inline editing.
    *   Real-time validation feedback.
*   **Database**: MongoDB
    *   Schema-enforced data integrity.
    *   Indexed for fast date/time lookups.

---

## 🧠 Core Logic & Pseudocode

The most complex part of the system is determining when the solar plant "started" and "stopped" generating power effectively based on weather conditions.

### 🔹 Logic: Plant Start/Stop Time Calculation

**Requirement:**
1.  **Start Time**: The first timestamp of the day where Plane of Array (POA) Irradiance is **≥ 10 W/m²**.
2.  **Stop Time**: The last timestamp of the day where POA is **> 0 W/m²** and **< 50 W/m²**.

**Pseudocode:**

```python
FUNCTION Calculate_Plant_Operation_Times(MeterDate, MeterTime):
    # 1. Fetch all weather records for the specific MeterDate
    # System handles format conversion (e.g., 22-06-2025 <-> 22-Jun-25)
    WeatherRecords = DB.FetchWeather(Date == MeterDate)

    IF WeatherRecords IS EMPTY:
        RETURN StartTime="00:00", StopTime="00:00"

    # --- Calculate Start Time ---
    # Sort weather records chronologically (AM to PM)
    Sort WeatherRecords Ascending by Time
    
    PlantStartTime = "00:00"
    FOR EACH Record IN WeatherRecords:
        IF Record.POA >= 10:
            PlantStartTime = Record.Time
            BREAK Loop # Found the first instance

    # --- Calculate Stop Time ---
    # Sort weather records reverse chronologically (PM to AM)
    Sort WeatherRecords Descending by Time
    
    PlantStopTime = "00:00"
    FOR EACH Record IN WeatherRecords:
        # Find last time (first in descending list) where mostly low light (evening)
        IF Record.POA > 0 AND Record.POA < 50:
            PlantStopTime = Record.Time
            BREAK Loop

    # Fallback: If no "low light" time found, find last time with ANY light
    IF PlantStopTime == "00:00":
        FOR EACH Record IN WeatherRecords:
            IF Record.POA > 0:
                PlantStopTime = Record.Time
                BREAK Loop

    RETURN PlantStartTime, PlantStopTime
```

---

## 🚀 Performance Optimizations

To handle large Excel files (e.g., 15k+ rows), the system implements several specific optimizations:

1.  **Batch Fetching**: Instead of querying the database for weather data 1,000 times for 1,000 meter rows, the system queries it **once** for all unique dates in the batch.
2.  **Parallel Processing**: Uses `Promise.all` to fetch or process non-dependent data concurrently.
3.  **BulkWrites**: Uses MongoDB `bulkWrite` with `ordered: false` to insert thousands of records in a single database round-trip, ignoring individual duplicate errors without stopping the process.

---

## 🛠️ Getting Started

### Prerequisites
*   Node.js (v16+)
*   MongoDB Instance

### Installation

1.  **Backend Setup**
    ```bash
    cd backend
    npm install
    npm run start:dev
    # Server runs on http://localhost:3000
    ```

2.  **Frontend Setup**
    ```bash
    cd frontend
    npm install
    npm start
    # App runs on http://localhost:3001
    ```

### Usage Workflow
1.  **Step 1**: Go to **Weather > Upload**. Upload your Weather Excel file first. This provides the reference data.
2.  **Step 2**: Go to **Meter > Upload**. Upload your Meter Excel file.
3.  **Step 3**: The system will auto-calculate Start/End times. Review the preview table, fix any errors, and click **Submit**.
