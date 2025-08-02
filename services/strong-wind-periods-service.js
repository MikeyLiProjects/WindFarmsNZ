const moment = require("moment");
const windDataService = require("./wind-data-service");
const fs = require("fs");
const path = require("path");

class StrongWindPeriodsService {
    constructor() {
        this.strongWindThreshold = 60; // km/h at 100m height
        this.minimumDurationHours = 6; // minimum duration for a strong wind period
        this.windFarms = this.loadWindFarms();
    }

    loadWindFarms() {
        try {
            const windFarmsData = JSON.parse(
                fs.readFileSync(
                    path.join(__dirname, "../data/nz-wind-farms.json"),
                    "utf8"
                )
            );
            return windFarmsData.windFarms.map((farm) => ({
                name: farm.name,
                lat: farm.lat,
                lon: farm.lon,
                region: farm.region,
                capacity: farm.capacity,
                operator: farm.operator,
            }));
        } catch (error) {
            console.error("Error loading wind farms:", error);
            return [];
        }
    }

    async analyzeStrongWindPeriods(startDate, endDate) {
        try {
            console.log(
                `Analyzing strong wind periods from ${startDate} to ${endDate}`
            );

            const windFarmAnalysis = [];
            const nzStrongWindPeriods = [];

            // Analyze each wind farm location
            for (const windFarm of this.windFarms) {
                try {
                    console.log(`Analyzing ${windFarm.name}...`);

                    const windData = await windDataService.getWindData(
                        windFarm.lat,
                        windFarm.lon,
                        startDate,
                        endDate
                    );

                    const periods = this.findStrongWindPeriods(
                        windData.historical,
                        windFarm
                    );

                    if (periods.length > 0) {
                        windFarmAnalysis.push({
                            windFarm: windFarm,
                            periods: periods,
                            totalPeriods: periods.length,
                            totalDuration: periods.reduce(
                                (sum, p) => sum + p.durationHours,
                                0
                            ),
                            maxWindSpeed: Math.max(
                                ...periods.map((p) => p.maxWindSpeed)
                            ),
                        });

                        // Add to NZ-wide strong wind periods
                        periods.forEach((period) => {
                            nzStrongWindPeriods.push({
                                windFarm: windFarm,
                                ...period,
                            });
                        });
                    }
                } catch (error) {
                    console.error(`Error analyzing ${windFarm.name}:`, error);
                }
            }

            // Sort periods by start time
            nzStrongWindPeriods.sort((a, b) =>
                moment(a.startTime).diff(moment(b.startTime))
            );

            // Group periods by date to find NZ-wide strong wind days
            const periodsByDate = this.groupPeriodsByDate(nzStrongWindPeriods);

            return {
                summary: {
                    totalWindFarms: this.windFarms.length,
                    windFarmsWithStrongWinds: windFarmAnalysis.length,
                    totalStrongWindPeriods: nzStrongWindPeriods.length,
                    totalDuration: nzStrongWindPeriods.reduce(
                        (sum, e) => sum + e.durationHours,
                        0
                    ),
                    dateRange: { start: startDate, end: endDate },
                },
                windFarmAnalysis: windFarmAnalysis,
                nzStrongWindPeriods: nzStrongWindPeriods,
                periodsByDate: periodsByDate,
                nzStrongWindDays: this.findNZStrongWindDays(periodsByDate),
            };
        } catch (error) {
            console.error("Error analyzing strong wind periods:", error);
            throw error;
        }
    }

    findStrongWindPeriods(data, windFarm) {
        const periods = [];
        let currentPeriod = null;

        for (let i = 0; i < data.length; i++) {
            const reading = data[i];
            // Use only 100m wind speed (turbine height)
            const windSpeed100m = reading.windSpeed100mKmh || 0;
            const isStrongWind = windSpeed100m >= this.strongWindThreshold;

            if (isStrongWind && !currentPeriod) {
                // Start of a strong wind period
                currentPeriod = {
                    startTime: reading.timestamp,
                    startWindSpeed: windSpeed100m,
                    maxWindSpeed: windSpeed100m,
                    readings: [reading],
                    windFarm: windFarm.name,
                };
            } else if (isStrongWind && currentPeriod) {
                // Continuation of strong wind period
                currentPeriod.readings.push(reading);
                currentPeriod.maxWindSpeed = Math.max(
                    currentPeriod.maxWindSpeed,
                    windSpeed100m
                );
            } else if (!isStrongWind && currentPeriod) {
                // End of strong wind period
                currentPeriod.endTime = reading.timestamp;
                currentPeriod.durationHours = moment(
                    currentPeriod.endTime
                ).diff(moment(currentPeriod.startTime), "hours", true);
                currentPeriod.avgWindSpeed =
                    currentPeriod.readings.reduce(
                        (sum, r) => sum + (r.windSpeed100mKmh || 0),
                        0
                    ) / currentPeriod.readings.length;

                // Only include periods that meet minimum duration
                if (currentPeriod.durationHours >= this.minimumDurationHours) {
                    periods.push(currentPeriod);
                }

                currentPeriod = null;
            }
        }

        // Handle case where period extends to end of data
        if (currentPeriod) {
            currentPeriod.endTime = data[data.length - 1].timestamp;
            currentPeriod.durationHours = moment(currentPeriod.endTime).diff(
                moment(currentPeriod.startTime),
                "hours",
                true
            );
            currentPeriod.avgWindSpeed =
                currentPeriod.readings.reduce(
                    (sum, r) => sum + (r.windSpeed100mKmh || 0),
                    0
                ) / currentPeriod.readings.length;

            if (currentPeriod.durationHours >= this.minimumDurationHours) {
                periods.push(currentPeriod);
            }
        }

        return periods;
    }

    groupPeriodsByDate(periods) {
        const grouped = {};

        periods.forEach((period) => {
            const date = moment(period.startTime).format("YYYY-MM-DD");
            if (!grouped[date]) {
                grouped[date] = [];
            }
            grouped[date].push(period);
        });

        return grouped;
    }

    findNZStrongWindDays(periodsByDate) {
        const nzStrongWindDays = [];

        Object.entries(periodsByDate).forEach(([date, periods]) => {
            const uniqueWindFarms = new Set(
                periods.map((p) => p.windFarm.name)
            );

            // If ANY wind farm experienced strong winds, it's an NZ strong wind day
            if (uniqueWindFarms.size >= 1) {
                nzStrongWindDays.push({
                    date: date,
                    windFarms: Array.from(uniqueWindFarms),
                    windFarmCount: uniqueWindFarms.size,
                    periods: periods,
                    totalDuration: periods.reduce(
                        (sum, p) => sum + p.durationHours,
                        0
                    ),
                    maxWindSpeed: Math.max(
                        ...periods.map((p) => p.maxWindSpeed)
                    ),
                });
            }
        });

        return nzStrongWindDays.sort(
            (a, b) => b.windFarmCount - a.windFarmCount
        );
    }

    async getStrongWindSummary(days = 7) {
        const endDate = moment().format("YYYY-MM-DD");
        const startDate = moment().subtract(days, "days").format("YYYY-MM-DD");

        return await this.analyzeStrongWindPeriods(startDate, endDate);
    }
}

module.exports = new StrongWindPeriodsService();
