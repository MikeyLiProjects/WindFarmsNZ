const moment = require("moment");
const windDataService = require("./wind-data-service");
const fs = require("fs").promises;
const path = require("path");

class MultiLocationAnalysisService {
    constructor() {
        this.strongWindThreshold = 60; // km/h
        this.windFarms = null;
    }

    async loadWindFarms() {
        try {
            const data = await fs.readFile(
                path.join(__dirname, "../data/nz-wind-farms.json"),
                "utf8"
            );
            this.windFarms = JSON.parse(data).windFarms;
            return this.windFarms;
        } catch (error) {
            console.error("Error loading wind farms:", error);
            throw error;
        }
    }

    async analyzeStrongWindEvent(startDate, endDate, threshold = 60) {
        try {
            if (!this.windFarms) {
                await this.loadWindFarms();
            }

            console.log(
                `Analyzing strong wind event from ${startDate} to ${endDate} across ${this.windFarms.length} wind farms...`
            );

            const analysisResults = [];
            const eventSummary = {
                startDate,
                endDate,
                threshold,
                totalFarms: this.windFarms.length,
                farmsAnalyzed: 0,
                farmsWithStrongWinds: 0,
                maxWindSpeed: 0,
                maxWindSpeedLocation: null,
                averageWindSpeeds: [],
                windSpeedRanking: [],
            };

            // Analyze each wind farm
            for (const farm of this.windFarms) {
                try {
                    console.log(`Analyzing ${farm.name}...`);

                    const farmAnalysis = await this.analyzeWindFarmDuringEvent(
                        farm,
                        startDate,
                        endDate,
                        threshold
                    );

                    analysisResults.push(farmAnalysis);
                    eventSummary.farmsAnalyzed++;

                    // Update event summary
                    if (farmAnalysis.hasStrongWinds) {
                        eventSummary.farmsWithStrongWinds++;
                    }

                    if (farmAnalysis.maxWindSpeed > eventSummary.maxWindSpeed) {
                        eventSummary.maxWindSpeed = farmAnalysis.maxWindSpeed;
                        eventSummary.maxWindSpeedLocation = farm.name;
                    }

                    if (farmAnalysis.averageWindSpeed > 0) {
                        eventSummary.averageWindSpeeds.push({
                            farmName: farm.name,
                            averageSpeed: farmAnalysis.averageWindSpeed,
                            region: farm.region,
                        });
                    }
                } catch (error) {
                    console.error(`Error analyzing ${farm.name}:`, error);
                    analysisResults.push({
                        farm: farm,
                        error: error.message,
                        hasStrongWinds: false,
                        maxWindSpeed: 0,
                        averageWindSpeed: 0,
                    });
                }
            }

            // Create wind speed ranking
            eventSummary.windSpeedRanking = analysisResults
                .filter((result) => !result.error)
                .sort((a, b) => b.maxWindSpeed - a.maxWindSpeed)
                .map((result, index) => ({
                    rank: index + 1,
                    farmName: result.farm.name,
                    region: result.farm.region,
                    maxWindSpeed: result.maxWindSpeed,
                    averageWindSpeed: result.averageWindSpeed,
                    capacity: result.farm.capacity,
                }));

            // Calculate overall statistics
            const validResults = analysisResults.filter(
                (result) => !result.error
            );
            const averageWindSpeeds = validResults
                .map((r) => r.averageWindSpeed)
                .filter((s) => s > 0);

            eventSummary.overallStats = {
                averageWindSpeedAcrossAllFarms:
                    averageWindSpeeds.length > 0
                        ? averageWindSpeeds.reduce(
                              (sum, speed) => sum + speed,
                              0
                          ) / averageWindSpeeds.length
                        : 0,
                medianWindSpeed: this.calculateMedian(averageWindSpeeds),
                standardDeviation:
                    this.calculateStandardDeviation(averageWindSpeeds),
                farmsAboveThreshold: eventSummary.farmsWithStrongWinds,
                percentageFarmsAffected:
                    (eventSummary.farmsWithStrongWinds /
                        eventSummary.farmsAnalyzed) *
                    100,
            };

            return {
                eventSummary,
                farmResults: analysisResults,
                recommendations: this.generateEventRecommendations(
                    eventSummary,
                    analysisResults
                ),
            };
        } catch (error) {
            console.error("Error in multi-location analysis:", error);
            throw error;
        }
    }

    async analyzeWindFarmDuringEvent(farm, startDate, endDate, threshold) {
        try {
            // Get wind data for the specific period
            const windData = await this.getWindDataForPeriod(
                farm.lat,
                farm.lon,
                startDate,
                endDate
            );

            if (!windData || windData.length === 0) {
                return {
                    farm: farm,
                    error: "No wind data available for this period",
                    hasStrongWinds: false,
                    maxWindSpeed: 0,
                    averageWindSpeed: 0,
                };
            }

            // Analyze wind patterns during the event
            const analysis = {
                farm: farm,
                period: { startDate, endDate, threshold },
                totalReadings: windData.length,
                maxWindSpeed: Math.max(...windData.map((d) => d.windSpeedKmh)),
                maxWindSpeed100m: Math.max(
                    ...windData.map((d) => d.windSpeed100mKmh || 0)
                ),
                maxWindGusts: Math.max(
                    ...windData.map((d) => d.windGustsKmh || 0)
                ),
                averageWindSpeed:
                    windData.reduce((sum, d) => sum + d.windSpeedKmh, 0) /
                    windData.length,
                averageWindSpeed100m:
                    windData.reduce(
                        (sum, d) => sum + (d.windSpeed100mKmh || 0),
                        0
                    ) / windData.length,
                averageWindGusts:
                    windData.reduce(
                        (sum, d) => sum + (d.windGustsKmh || 0),
                        0
                    ) / windData.length,
                strongWindReadings: windData.filter(
                    (d) => d.windSpeedKmh >= threshold
                ).length,
                strongWindPercentage: 0,
                hasStrongWinds: false,
                strongWindPeriods: this.findStrongWindPeriods(
                    windData,
                    threshold
                ),
                hourlyDistribution: this.calculateHourlyDistribution(windData),
                windRose: this.calculateWindRose(windData),
            };

            analysis.strongWindPercentage =
                (analysis.strongWindReadings / analysis.totalReadings) * 100;
            analysis.hasStrongWinds = analysis.strongWindReadings > 0;

            return analysis;
        } catch (error) {
            console.error(`Error analyzing wind farm ${farm.name}:`, error);
            throw error;
        }
    }

    async getWindDataForPeriod(lat, lon, startDate, endDate) {
        try {
            const params = {
                latitude: parseFloat(lat),
                longitude: parseFloat(lon),
                start_date: startDate,
                end_date: endDate,
                hourly: [
                    "wind_speed_10m",
                    "wind_speed_100m",
                    "wind_direction_10m",
                    "wind_direction_100m",
                    "wind_gusts_10m",
                    "temperature_2m",
                    "relative_humidity_2m",
                    "pressure_msl",
                ],
                timezone: "Pacific/Auckland",
            };

            const { fetchWeatherApi } = require("openmeteo");
            const responses = await fetchWeatherApi(
                "https://archive-api.open-meteo.com/v1/archive",
                params
            );
            const response = responses[0];

            const hourly = response.hourly();
            const utcOffsetSeconds = response.utcOffsetSeconds();

            // Process the hourly data
            const timeArray = [
                ...Array(
                    (Number(hourly.timeEnd()) - Number(hourly.time())) /
                        hourly.interval()
                ),
            ].map(
                (_, i) =>
                    new Date(
                        (Number(hourly.time()) +
                            i * hourly.interval() +
                            utcOffsetSeconds) *
                            1000
                    )
            );

            const windSpeed10m = hourly.variables(0).valuesArray();
            const windSpeed100m = hourly.variables(1).valuesArray();
            const windDirection10m = hourly.variables(2).valuesArray();
            const windDirection100m = hourly.variables(3).valuesArray();
            const windGusts10m = hourly.variables(4).valuesArray();
            const temperature2m = hourly.variables(5).valuesArray();
            const relativeHumidity2m = hourly.variables(6).valuesArray();
            const pressureMsl = hourly.variables(7).valuesArray();

            // Format the data
            return timeArray.map((time, index) => ({
                timestamp: time.toISOString(),
                windSpeed: windSpeed10m[index] || 0,
                windSpeedKmh: windSpeed10m[index] || 0, // Already in km/h from API
                windSpeed100m: windSpeed100m[index] || 0,
                windSpeed100mKmh: windSpeed100m[index] || 0, // Already in km/h from API
                windDirection: windDirection10m[index] || 0,
                windDirection100m: windDirection100m[index] || 0,
                windGusts: windGusts10m[index] || 0,
                windGustsKmh: windGusts10m[index] || 0, // Already in km/h from API
                temperature: temperature2m[index] || 0,
                humidity: relativeHumidity2m[index] || 0,
                pressure: pressureMsl[index] || 0,
            }));
        } catch (error) {
            console.error("Error fetching wind data for period:", error);
            return [];
        }
    }

    findStrongWindPeriods(data, threshold) {
        const periods = [];
        let currentPeriod = null;

        for (let i = 0; i < data.length; i++) {
            const reading = data[i];
            const isStrongWind = reading.windSpeedKmh >= threshold;

            if (isStrongWind && !currentPeriod) {
                currentPeriod = {
                    start: reading.timestamp,
                    startWindSpeed: reading.windSpeedKmh,
                    readings: [reading],
                };
            } else if (isStrongWind && currentPeriod) {
                currentPeriod.readings.push(reading);
            } else if (!isStrongWind && currentPeriod) {
                currentPeriod.end = reading.timestamp;
                const duration = moment.duration(
                    moment(currentPeriod.end).diff(moment(currentPeriod.start))
                );
                currentPeriod.duration = {
                    hours: Math.floor(duration.asHours()),
                    minutes: Math.floor(duration.asMinutes()) % 60,
                    totalMinutes: Math.floor(duration.asMinutes()),
                    totalMilliseconds: duration.asMilliseconds(),
                };
                currentPeriod.maxWindSpeed = Math.max(
                    ...currentPeriod.readings.map((r) => r.windSpeedKmh)
                );
                currentPeriod.avgWindSpeed =
                    currentPeriod.readings.reduce(
                        (sum, r) => sum + r.windSpeedKmh,
                        0
                    ) / currentPeriod.readings.length;

                periods.push(currentPeriod);
                currentPeriod = null;
            }
        }

        if (currentPeriod) {
            currentPeriod.end = data[data.length - 1].timestamp;
            const duration = moment.duration(
                moment(currentPeriod.end).diff(moment(currentPeriod.start))
            );
            currentPeriod.duration = {
                hours: Math.floor(duration.asHours()),
                minutes: Math.floor(duration.asMinutes()) % 60,
                totalMinutes: Math.floor(duration.asMinutes()),
                totalMilliseconds: duration.asMilliseconds(),
            };
            currentPeriod.maxWindSpeed = Math.max(
                ...currentPeriod.readings.map((r) => r.windSpeedKmh)
            );
            currentPeriod.avgWindSpeed =
                currentPeriod.readings.reduce(
                    (sum, r) => sum + r.windSpeedKmh,
                    0
                ) / currentPeriod.readings.length;

            periods.push(currentPeriod);
        }

        return periods;
    }

    calculateHourlyDistribution(data) {
        const hourlyStats = {};

        for (let hour = 0; hour < 24; hour++) {
            hourlyStats[hour] = {
                count: 0,
                totalWindSpeed: 0,
                maxWindSpeed: 0,
            };
        }

        data.forEach((reading) => {
            const hour = moment(reading.timestamp).hour();
            hourlyStats[hour].count++;
            hourlyStats[hour].totalWindSpeed += reading.windSpeedKmh;
            hourlyStats[hour].maxWindSpeed = Math.max(
                hourlyStats[hour].maxWindSpeed,
                reading.windSpeedKmh
            );
        });

        Object.keys(hourlyStats).forEach((hour) => {
            const stats = hourlyStats[hour];
            stats.avgWindSpeed =
                stats.count > 0 ? stats.totalWindSpeed / stats.count : 0;
        });

        return hourlyStats;
    }

    calculateWindRose(data) {
        const directions = {};
        const directionNames = [
            "N",
            "NNE",
            "NE",
            "ENE",
            "E",
            "ESE",
            "SE",
            "SSE",
            "S",
            "SSW",
            "SW",
            "WSW",
            "W",
            "WNW",
            "NW",
            "NNW",
        ];

        directionNames.forEach((dir) => {
            directions[dir] = {
                count: 0,
                totalSpeed: 0,
            };
        });

        data.forEach((reading) => {
            const direction = this.getWindDirection(reading.windDirection);
            directions[direction].count++;
            directions[direction].totalSpeed += reading.windSpeedKmh;
        });

        Object.keys(directions).forEach((dir) => {
            const stats = directions[dir];
            stats.avgSpeed =
                stats.count > 0 ? stats.totalSpeed / stats.count : 0;
        });

        return directions;
    }

    getWindDirection(degrees) {
        const directions = [
            "N",
            "NNE",
            "NE",
            "ENE",
            "E",
            "ESE",
            "SE",
            "SSE",
            "S",
            "SSW",
            "SW",
            "WSW",
            "W",
            "WNW",
            "NW",
            "NNW",
        ];
        const index = Math.round(degrees / 22.5) % 16;
        return directions[index];
    }

    calculateMedian(values) {
        if (values.length === 0) return 0;
        const sorted = values.sort((a, b) => a - b);
        const middle = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0
            ? (sorted[middle - 1] + sorted[middle]) / 2
            : sorted[middle];
    }

    calculateStandardDeviation(values) {
        if (values.length === 0) return 0;
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const squaredDiffs = values.map((val) => Math.pow(val - mean, 2));
        const avgSquaredDiff =
            squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
        return Math.sqrt(avgSquaredDiff);
    }

    generateEventRecommendations(eventSummary, farmResults) {
        const recommendations = [];

        // Overall event recommendations
        if (eventSummary.overallStats.percentageFarmsAffected > 50) {
            recommendations.push({
                type: "warning",
                message: `High-impact wind event: ${eventSummary.overallStats.percentageFarmsAffected.toFixed(
                    1
                )}% of wind farms affected by strong winds.`,
                impact: "Grid-wide",
            });
        }

        if (eventSummary.maxWindSpeed > 100) {
            recommendations.push({
                type: "danger",
                message: `Extreme wind speeds recorded at ${
                    eventSummary.maxWindSpeedLocation
                } (${eventSummary.maxWindSpeed.toFixed(
                    1
                )} km/h). Immediate safety protocols recommended.`,
                impact: "Safety",
            });
        }

        // Regional analysis
        const regionalStats = this.analyzeRegionalImpact(farmResults);
        Object.keys(regionalStats).forEach((region) => {
            const stats = regionalStats[region];
            if (stats.averageWindSpeed > 80) {
                recommendations.push({
                    type: "warning",
                    message: `High wind speeds in ${region} region (avg: ${stats.averageWindSpeed.toFixed(
                        1
                    )} km/h). Monitor regional grid stability.`,
                    impact: "Regional",
                });
            }
        });

        // Top performing farms
        const topFarms = eventSummary.windSpeedRanking.slice(0, 3);
        if (topFarms.length > 0) {
            recommendations.push({
                type: "info",
                message: `Top wind farm performers: ${topFarms
                    .map((f) => f.farmName)
                    .join(", ")}. Consider grid prioritization.`,
                impact: "Operational",
            });
        }

        return recommendations;
    }

    analyzeRegionalImpact(farmResults) {
        const regionalStats = {};

        farmResults.forEach((result) => {
            if (result.error) return;

            const region = result.farm.region;
            if (!regionalStats[region]) {
                regionalStats[region] = {
                    farms: 0,
                    totalWindSpeed: 0,
                    maxWindSpeed: 0,
                    farmsWithStrongWinds: 0,
                };
            }

            regionalStats[region].farms++;
            regionalStats[region].totalWindSpeed += result.averageWindSpeed;
            regionalStats[region].maxWindSpeed = Math.max(
                regionalStats[region].maxWindSpeed,
                result.maxWindSpeed
            );

            if (result.hasStrongWinds) {
                regionalStats[region].farmsWithStrongWinds++;
            }
        });

        Object.keys(regionalStats).forEach((region) => {
            const stats = regionalStats[region];
            stats.averageWindSpeed = stats.totalWindSpeed / stats.farms;
            stats.percentageAffected =
                (stats.farmsWithStrongWinds / stats.farms) * 100;
        });

        return regionalStats;
    }
}

module.exports = new MultiLocationAnalysisService();
