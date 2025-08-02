const moment = require("moment");
const windDataService = require("./wind-data-service");
const fs = require("fs").promises;
const path = require("path");

class TimePeriodsAnalysisService {
    constructor() {
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

    async analyzeTimePeriods(timePeriods) {
        try {
            if (!this.windFarms) {
                await this.loadWindFarms();
            }

            console.log(
                `Analyzing ${timePeriods.length} time periods across ${this.windFarms.length} wind farms...`
            );

            const farmResults = [];

            // Analyze each wind farm
            for (const farm of this.windFarms) {
                try {
                    console.log(`Analyzing ${farm.name}...`);

                    const farmAnalysis =
                        await this.analyzeWindFarmForTimePeriods(
                            farm,
                            timePeriods
                        );

                    farmResults.push(farmAnalysis);
                } catch (error) {
                    console.error(`Error analyzing ${farm.name}:`, error);
                    farmResults.push({
                        name: farm.name,
                        error: error.message,
                        averageSpeeds: timePeriods.map(() => null),
                    });
                }
            }

            return {
                farms: farmResults,
                timePeriods: timePeriods,
                summary: this.generateSummary(farmResults, timePeriods),
            };
        } catch (error) {
            console.error("Error in time periods analysis:", error);
            throw error;
        }
    }

    async analyzeWindFarmForTimePeriods(farm, timePeriods) {
        try {
            const averageSpeeds = [];

            for (const period of timePeriods) {
                try {
                    const windData = await this.getWindDataForPeriod(
                        farm.lat,
                        farm.lon,
                        period.start,
                        period.end
                    );

                    if (!windData || windData.length === 0) {
                        averageSpeeds.push(null);
                        continue;
                    }

                    // Calculate average wind speed for this period
                    const totalSpeed = windData.reduce(
                        (sum, reading) => sum + reading.windSpeedKmh,
                        0
                    );
                    const averageSpeed = totalSpeed / windData.length;
                    averageSpeeds.push(averageSpeed);
                } catch (error) {
                    console.error(
                        `Error analyzing period for ${farm.name}:`,
                        error
                    );
                    averageSpeeds.push(null);
                }
            }

            return {
                name: farm.name,
                averageSpeeds: averageSpeeds,
            };
        } catch (error) {
            console.error(`Error analyzing wind farm ${farm.name}:`, error);
            throw error;
        }
    }

    async getWindDataForPeriod(lat, lon, startTime, endTime) {
        try {
            const startDate = moment(startTime).format("YYYY-MM-DD");
            const endDate = moment(endTime).format("YYYY-MM-DD");

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

            // Format the data and filter by time period
            const allData = timeArray.map((time, index) => ({
                timestamp: time.toISOString(),
                windSpeed: windSpeed10m[index] || 0,
                windSpeedKmh: windSpeed10m[index] || 0,
                windSpeed100m: windSpeed100m[index] || 0,
                windSpeed100mKmh: windSpeed100m[index] || 0,
                windDirection: windDirection10m[index] || 0,
                windDirection100m: windDirection100m[index] || 0,
                windGusts: windGusts10m[index] || 0,
                windGustsKmh: windGusts10m[index] || 0,
                temperature: temperature2m[index] || 0,
                humidity: relativeHumidity2m[index] || 0,
                pressure: pressureMsl[index] || 0,
            }));

            // Filter data to only include readings within the specific time period
            const startMoment = moment(startTime);
            const endMoment = moment(endTime);

            return allData.filter((reading) => {
                const readingMoment = moment(reading.timestamp);
                return readingMoment.isBetween(
                    startMoment,
                    endMoment,
                    null,
                    "[]"
                ); // inclusive
            });
        } catch (error) {
            console.error("Error fetching wind data for period:", error);
            return [];
        }
    }

    generateSummary(farmResults, timePeriods) {
        const validResults = farmResults.filter((result) => !result.error);

        // Calculate overall statistics
        const allAverageSpeeds = validResults.flatMap((result) =>
            result.averageSpeeds.filter((speed) => speed !== null)
        );

        const summary = {
            totalFarms: farmResults.length,
            farmsWithData: validResults.length,
            totalTimePeriods: timePeriods.length,
            overallAverageWindSpeed:
                allAverageSpeeds.length > 0
                    ? allAverageSpeeds.reduce((sum, speed) => sum + speed, 0) /
                      allAverageSpeeds.length
                    : 0,
            maxAverageWindSpeed:
                allAverageSpeeds.length > 0 ? Math.max(...allAverageSpeeds) : 0,
            minAverageWindSpeed:
                allAverageSpeeds.length > 0 ? Math.min(...allAverageSpeeds) : 0,
        };

        return summary;
    }
}

module.exports = new TimePeriodsAnalysisService();
