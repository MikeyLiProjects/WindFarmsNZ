const moment = require("moment");
const windDataService = require("./wind-data-service");

class WindAnalysisService {
    constructor() {
        this.strongWindThreshold = 60; // km/h
        this.extremeWindThreshold = 100; // km/h
    }

    async analyzeWindPatterns(lat, lon) {
        try {
            const windData = await windDataService.getWindData(lat, lon);

            // Combine all data sources
            const allData = [...windData.historical, ...windData.forecast].sort(
                (a, b) => moment(a.timestamp).diff(moment(b.timestamp))
            );

            const analysis = {
                location: windData.location,
                threshold: this.strongWindThreshold,
                extremeThreshold: this.extremeWindThreshold,
                summary: this.calculateSummary(allData),
                strongWindPeriods: this.findStrongWindPeriods(allData),
                hourlyDistribution: this.calculateHourlyDistribution(allData),
                dailyDistribution: this.calculateDailyDistribution(allData),
                windRose: this.calculateWindRose(allData),
                windGustAnalysis: this.analyzeWindGusts(allData),
                heightComparison: this.compareWindHeights(allData),
                recommendations: this.generateRecommendations(allData),
            };

            return analysis;
        } catch (error) {
            console.error("Error analyzing wind patterns:", error);
            throw error;
        }
    }

    calculateSummary(data) {
        const totalReadings = data.length;
        const strongWindReadings = data.filter(
            (d) => d.windSpeedKmh >= this.strongWindThreshold
        ).length;
        const extremeWindReadings = data.filter(
            (d) => d.windSpeedKmh >= this.extremeWindThreshold
        ).length;
        const maxWindSpeed = Math.max(...data.map((d) => d.windSpeedKmh));
        const maxWindSpeed100m = Math.max(
            ...data.map((d) => d.windSpeed100mKmh || 0)
        );
        const maxWindGusts = Math.max(...data.map((d) => d.windGustsKmh || 0));
        const avgWindSpeed =
            data.reduce((sum, d) => sum + d.windSpeedKmh, 0) / totalReadings;
        const avgWindSpeed100m =
            data.reduce((sum, d) => sum + (d.windSpeed100mKmh || 0), 0) /
            totalReadings;

        return {
            totalReadings,
            strongWindReadings,
            strongWindPercentage: (strongWindReadings / totalReadings) * 100,
            extremeWindReadings,
            extremeWindPercentage: (extremeWindReadings / totalReadings) * 100,
            maxWindSpeed,
            maxWindSpeed100m,
            maxWindGusts,
            averageWindSpeed: avgWindSpeed,
            averageWindSpeed100m: avgWindSpeed100m,
            dataTimeSpan: {
                start: data[0]?.timestamp,
                end: data[data.length - 1]?.timestamp,
            },
        };
    }

    findStrongWindPeriods(data) {
        const periods = [];
        let currentPeriod = null;

        for (let i = 0; i < data.length; i++) {
            const reading = data[i];
            const isStrongWind =
                reading.windSpeedKmh >= this.strongWindThreshold;

            if (isStrongWind && !currentPeriod) {
                // Start of a strong wind period
                currentPeriod = {
                    start: reading.timestamp,
                    startWindSpeed: reading.windSpeedKmh,
                    startWindSpeed100m: reading.windSpeed100mKmh || 0,
                    startWindGusts: reading.windGustsKmh || 0,
                    readings: [reading],
                };
            } else if (isStrongWind && currentPeriod) {
                // Continuation of strong wind period
                currentPeriod.readings.push(reading);
            } else if (!isStrongWind && currentPeriod) {
                // End of strong wind period
                currentPeriod.end = reading.timestamp;
                currentPeriod.endWindSpeed = reading.windSpeedKmh;
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
                currentPeriod.maxWindSpeed100m = Math.max(
                    ...currentPeriod.readings.map(
                        (r) => r.windSpeed100mKmh || 0
                    )
                );
                currentPeriod.maxWindGusts = Math.max(
                    ...currentPeriod.readings.map((r) => r.windGustsKmh || 0)
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

        // Handle case where strong wind period extends to the end of data
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
            currentPeriod.maxWindSpeed100m = Math.max(
                ...currentPeriod.readings.map((r) => r.windSpeed100mKmh || 0)
            );
            currentPeriod.maxWindGusts = Math.max(
                ...currentPeriod.readings.map((r) => r.windGustsKmh || 0)
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

    analyzeWindGusts(data) {
        const gustAnalysis = {
            totalReadings: data.length,
            gustReadings: data.filter((d) => (d.windGustsKmh || 0) > 0).length,
            maxGust: Math.max(...data.map((d) => d.windGustsKmh || 0)),
            avgGust:
                data.reduce((sum, d) => sum + (d.windGustsKmh || 0), 0) /
                data.length,
            strongGustReadings: data.filter(
                (d) => (d.windGustsKmh || 0) >= this.strongWindThreshold
            ).length,
            extremeGustReadings: data.filter(
                (d) => (d.windGustsKmh || 0) >= this.extremeWindThreshold
            ).length,
        };

        gustAnalysis.gustPercentage =
            (gustAnalysis.gustReadings / gustAnalysis.totalReadings) * 100;
        gustAnalysis.strongGustPercentage =
            (gustAnalysis.strongGustReadings / gustAnalysis.totalReadings) *
            100;
        gustAnalysis.extremeGustPercentage =
            (gustAnalysis.extremeGustReadings / gustAnalysis.totalReadings) *
            100;

        return gustAnalysis;
    }

    compareWindHeights(data) {
        const heightComparison = {
            totalReadings: data.length,
            avgSpeed10m:
                data.reduce((sum, d) => sum + d.windSpeedKmh, 0) / data.length,
            avgSpeed100m:
                data.reduce((sum, d) => sum + (d.windSpeed100mKmh || 0), 0) /
                data.length,
            maxSpeed10m: Math.max(...data.map((d) => d.windSpeedKmh)),
            maxSpeed100m: Math.max(...data.map((d) => d.windSpeed100mKmh || 0)),
            speedRatio: 0, // Will be calculated below
        };

        heightComparison.speedRatio =
            heightComparison.avgSpeed100m / heightComparison.avgSpeed10m;

        return heightComparison;
    }

    calculateHourlyDistribution(data) {
        const hourlyStats = {};

        for (let hour = 0; hour < 24; hour++) {
            hourlyStats[hour] = {
                count: 0,
                strongWindCount: 0,
                extremeWindCount: 0,
                totalWindSpeed: 0,
                totalWindSpeed100m: 0,
                totalWindGusts: 0,
                maxWindSpeed: 0,
                maxWindSpeed100m: 0,
                maxWindGusts: 0,
            };
        }

        data.forEach((reading) => {
            const hour = moment(reading.timestamp).hour();
            hourlyStats[hour].count++;
            hourlyStats[hour].totalWindSpeed += reading.windSpeedKmh;
            hourlyStats[hour].totalWindSpeed100m +=
                reading.windSpeed100mKmh || 0;
            hourlyStats[hour].totalWindGusts += reading.windGustsKmh || 0;
            hourlyStats[hour].maxWindSpeed = Math.max(
                hourlyStats[hour].maxWindSpeed,
                reading.windSpeedKmh
            );
            hourlyStats[hour].maxWindSpeed100m = Math.max(
                hourlyStats[hour].maxWindSpeed100m,
                reading.windSpeed100mKmh || 0
            );
            hourlyStats[hour].maxWindGusts = Math.max(
                hourlyStats[hour].maxWindGusts,
                reading.windGustsKmh || 0
            );

            if (reading.windSpeedKmh >= this.strongWindThreshold) {
                hourlyStats[hour].strongWindCount++;
            }
            if (reading.windSpeedKmh >= this.extremeWindThreshold) {
                hourlyStats[hour].extremeWindCount++;
            }
        });

        // Calculate averages
        Object.keys(hourlyStats).forEach((hour) => {
            const stats = hourlyStats[hour];
            stats.avgWindSpeed =
                stats.count > 0 ? stats.totalWindSpeed / stats.count : 0;
            stats.avgWindSpeed100m =
                stats.count > 0 ? stats.totalWindSpeed100m / stats.count : 0;
            stats.avgWindGusts =
                stats.count > 0 ? stats.totalWindGusts / stats.count : 0;
            stats.strongWindPercentage =
                stats.count > 0
                    ? (stats.strongWindCount / stats.count) * 100
                    : 0;
            stats.extremeWindPercentage =
                stats.count > 0
                    ? (stats.extremeWindCount / stats.count) * 100
                    : 0;
        });

        return hourlyStats;
    }

    calculateDailyDistribution(data) {
        const dailyStats = {};

        data.forEach((reading) => {
            const day = moment(reading.timestamp).format("YYYY-MM-DD");

            if (!dailyStats[day]) {
                dailyStats[day] = {
                    count: 0,
                    strongWindCount: 0,
                    extremeWindCount: 0,
                    totalWindSpeed: 0,
                    totalWindSpeed100m: 0,
                    totalWindGusts: 0,
                    maxWindSpeed: 0,
                    maxWindSpeed100m: 0,
                    maxWindGusts: 0,
                    minWindSpeed: Infinity,
                };
            }

            const stats = dailyStats[day];
            stats.count++;
            stats.totalWindSpeed += reading.windSpeedKmh;
            stats.totalWindSpeed100m += reading.windSpeed100mKmh || 0;
            stats.totalWindGusts += reading.windGustsKmh || 0;
            stats.maxWindSpeed = Math.max(
                stats.maxWindSpeed,
                reading.windSpeedKmh
            );
            stats.maxWindSpeed100m = Math.max(
                stats.maxWindSpeed100m,
                reading.windSpeed100mKmh || 0
            );
            stats.maxWindGusts = Math.max(
                stats.maxWindGusts,
                reading.windGustsKmh || 0
            );
            stats.minWindSpeed = Math.min(
                stats.minWindSpeed,
                reading.windSpeedKmh
            );

            if (reading.windSpeedKmh >= this.strongWindThreshold) {
                stats.strongWindCount++;
            }
            if (reading.windSpeedKmh >= this.extremeWindThreshold) {
                stats.extremeWindCount++;
            }
        });

        // Calculate averages
        Object.keys(dailyStats).forEach((day) => {
            const stats = dailyStats[day];
            stats.avgWindSpeed = stats.totalWindSpeed / stats.count;
            stats.avgWindSpeed100m = stats.totalWindSpeed100m / stats.count;
            stats.avgWindGusts = stats.totalWindGusts / stats.count;
            stats.strongWindPercentage =
                (stats.strongWindCount / stats.count) * 100;
            stats.extremeWindPercentage =
                (stats.extremeWindCount / stats.count) * 100;
            stats.minWindSpeed =
                stats.minWindSpeed === Infinity ? 0 : stats.minWindSpeed;
        });

        return dailyStats;
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
                totalSpeed100m: 0,
                strongWindCount: 0,
                extremeWindCount: 0,
            };
        });

        data.forEach((reading) => {
            const direction = this.getWindDirection(reading.windDirection);
            directions[direction].count++;
            directions[direction].totalSpeed += reading.windSpeedKmh;
            directions[direction].totalSpeed100m +=
                reading.windSpeed100mKmh || 0;

            if (reading.windSpeedKmh >= this.strongWindThreshold) {
                directions[direction].strongWindCount++;
            }
            if (reading.windSpeedKmh >= this.extremeWindThreshold) {
                directions[direction].extremeWindCount++;
            }
        });

        // Calculate averages and percentages
        Object.keys(directions).forEach((dir) => {
            const stats = directions[dir];
            stats.avgSpeed =
                stats.count > 0 ? stats.totalSpeed / stats.count : 0;
            stats.avgSpeed100m =
                stats.count > 0 ? stats.totalSpeed100m / stats.count : 0;
            stats.strongWindPercentage =
                stats.count > 0
                    ? (stats.strongWindCount / stats.count) * 100
                    : 0;
            stats.extremeWindPercentage =
                stats.count > 0
                    ? (stats.extremeWindCount / stats.count) * 100
                    : 0;
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

    generateRecommendations(data) {
        const summary = this.calculateSummary(data);
        const gustAnalysis = this.analyzeWindGusts(data);
        const heightComparison = this.compareWindHeights(data);
        const recommendations = [];

        if (summary.strongWindPercentage > 20) {
            recommendations.push({
                type: "warning",
                message:
                    "High frequency of strong winds detected. Consider wind farm shutdown protocols.",
                percentage: summary.strongWindPercentage,
            });
        }

        if (summary.extremeWindPercentage > 5) {
            recommendations.push({
                type: "danger",
                message:
                    "Significant extreme wind events detected. Review safety protocols.",
                percentage: summary.extremeWindPercentage,
            });
        }

        if (summary.maxWindSpeed > 100) {
            recommendations.push({
                type: "danger",
                message:
                    "Extreme wind speeds recorded. Immediate safety protocols recommended.",
                maxSpeed: summary.maxWindSpeed,
            });
        }

        if (gustAnalysis.strongGustPercentage > 15) {
            recommendations.push({
                type: "warning",
                message:
                    "Frequent strong wind gusts detected. Monitor turbine stress levels.",
                percentage: gustAnalysis.strongGustPercentage,
            });
        }

        if (heightComparison.speedRatio > 1.5) {
            recommendations.push({
                type: "info",
                message:
                    "Significant wind speed increase with height. Consider taller turbines for better efficiency.",
                ratio: heightComparison.speedRatio.toFixed(2),
            });
        }

        if (summary.averageWindSpeed < 20) {
            recommendations.push({
                type: "info",
                message:
                    "Low average wind speeds. May impact energy production efficiency.",
                avgSpeed: summary.averageWindSpeed,
            });
        }

        return recommendations;
    }
}

module.exports = new WindAnalysisService();
