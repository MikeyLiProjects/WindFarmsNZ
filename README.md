# New Zealand Wind Farm Analysis

A comprehensive wind analysis application for New Zealand wind farms, providing detailed insights into wind patterns, strong wind periods, and multi-location analysis.

## Features

### 1. Single Location Analysis

-   Analyze wind patterns for any location in New Zealand
-   View current wind speed, historical data, and forecasts
-   Strong wind period identification
-   Wind direction rose charts
-   Hourly and daily wind distribution analysis

### 2. Multi-Location Analysis

-   Compare wind patterns across multiple wind farm locations
-   Analyze strong wind events across different regions
-   Comprehensive wind farm data integration

### 3. Strong Wind Periods Analysis (NEW!)

-   **Find time periods when New Zealand wind farms experience strong winds**
-   Analyzes 15 major NZ wind farms for wind speeds ≥60 km/h at 100m height lasting 6+ hours
-   If ANY wind farm experiences strong winds, considers the whole of NZ to be in a strong wind period
-   Provides detailed timeline and wind farm-based analysis
-   Features:
    -   Date range selection (last 7, 14, 30, or 90 days)
    -   NZ strong wind day detection (any wind farm affected)
    -   Interactive charts showing period timeline and wind farm distribution
    -   Searchable list of all strong wind periods
    -   Wind farm-by-wind farm analysis summary

## Strong Wind Definition

A strong wind period is defined as:

-   **Wind speed**: Average of 60 km/h or above at 100m height (turbine height)
-   **Duration**: At least 6 consecutive hours
-   **Coverage**: Analyzes 15 major New Zealand wind farms
-   **Logic**: If ANY wind farm experiences strong winds, the whole of NZ is considered to be in a strong wind period

## Wind Farms Analyzed

### North Island

-   Te Apiti Wind Farm, West Wind Wind Farm, Tararua Wind Farm
-   Hau Nui Wind Farm, Mill Creek Wind Farm, Te Uku Wind Farm
-   Waipipi Wind Farm, Turitea Wind Farm, Puketoi Wind Farm, Harapaki Wind Farm

### South Island

-   White Hill Wind Farm, Mahinerangi Wind Farm, Hurunui Wind Farm
-   Kaiwera Downs Wind Farm, Kaiwera Downs Wind Farm Extension

## API Endpoints

-   `GET /` - Main analysis page
-   `GET /multi-location.html` - Multi-location analysis
-   `GET /strong-wind-periods` - Strong wind periods analysis
-   `GET /api/analysis/:lat/:lon` - Single location analysis
-   `GET /api/multi-location-analysis` - Multi-location analysis data
-   `GET /api/strong-wind-periods` - Strong wind periods data
-   `GET /api/wind-farms` - Wind farm data

## Usage

1. **Start the server**:

    ```bash
    npm start
    ```

2. **Access the application**:

    - Main analysis: http://localhost:3000
    - Multi-location analysis: http://localhost:3000/multi-location.html
    - Strong wind periods: http://localhost:3000/strong-wind-periods

3. **Strong Wind Periods Analysis**:
    - Select a date range or use quick select options
    - View summary statistics and NZ strong wind days
    - Explore detailed period timeline and wind farm distribution
    - Search through individual strong wind periods

## Data Sources

-   **Weather Data**: Open-Meteo API (free, no API key required)
-   **Wind Farm Data**: Local JSON database of NZ wind farms
-   **Historical Data**: Up to 365 days of historical weather data
-   **Forecast Data**: 7-day weather forecasts

## Technology Stack

-   **Backend**: Node.js, Express
-   **Frontend**: HTML5, CSS3, JavaScript, Chart.js
-   **Styling**: Tailwind CSS
-   **Weather API**: Open-Meteo
-   **Data Processing**: Moment.js for date handling

## Installation

```bash
npm install
npm start
```

The application will be available at http://localhost:3000
