const { fetchWeatherApi } = require("openmeteo");
const moment = require("moment");

class WindDataService {
    constructor() {
        this.baseUrl = "https://archive-api.open-meteo.com/v1/archive";
        this.forecastUrl = "https://api.open-meteo.com/v1/forecast";
    }

    async getWindData(lat, lon, startDate = null, endDate = null) {
        try {
            // Get historical data for the specified date range or past year
            const historicalData = await this.getHistoricalData(
                lat,
                lon,
                startDate,
                endDate
            );

            // Get current and forecast data
            const currentForecastData = await this.getCurrentForecastData(
                lat,
                lon
            );

            return {
                current: currentForecastData.current,
                forecast: currentForecastData.forecast,
                historical: historicalData,
                location: {
                    lat: parseFloat(lat),
                    lon: parseFloat(lon),
                    name: this.getLocationName(lat, lon),
                },
            };
        } catch (error) {
            console.error("Error fetching wind data:", error.message);
            throw error;
        }
    }

    async getHistoricalData(lat, lon, startDate = null, endDate = null) {
        try {
            // Use provided dates or default to past year
            const endDateFormatted =
                endDate || moment().subtract(1, "day").format("YYYY-MM-DD");
            const startDateFormatted =
                startDate ||
                moment().subtract(365, "days").format("YYYY-MM-DD");

            const params = {
                latitude: parseFloat(lat),
                longitude: parseFloat(lon),
                start_date: startDateFormatted,
                end_date: endDateFormatted,
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

            const responses = await fetchWeatherApi(this.baseUrl, params);
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
            const formattedData = timeArray.map((time, index) => ({
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

            return formattedData;
        } catch (error) {
            console.error("Error fetching historical data:", error.message);
            return [];
        }
    }

    async getCurrentForecastData(lat, lon) {
        try {
            const params = {
                latitude: parseFloat(lat),
                longitude: parseFloat(lon),
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

            const responses = await fetchWeatherApi(this.forecastUrl, params);
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
            const formattedData = timeArray.map((time, index) => ({
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

            // Get current conditions (first entry)
            const current =
                formattedData[0] ||
                this.formatCurrentData({
                    windSpeed: 0,
                    windSpeedKmh: 0,
                    windDirection: 0,
                    temperature: 0,
                    humidity: 0,
                    pressure: 0,
                });

            // Get forecast (remaining entries)
            const forecast = formattedData.slice(1);

            return { current, forecast };
        } catch (error) {
            console.error(
                "Error fetching current/forecast data:",
                error.message
            );
            return {
                current: this.formatCurrentData({
                    windSpeed: 0,
                    windSpeedKmh: 0,
                    windDirection: 0,
                    temperature: 0,
                    humidity: 0,
                    pressure: 0,
                }),
                forecast: [],
            };
        }
    }

    formatCurrentData(data) {
        return {
            timestamp: new Date().toISOString(),
            windSpeed: data.windSpeed || 0,
            windSpeedKmh: data.windSpeedKmh || 0,
            windDirection: data.windDirection || 0,
            temperature: data.temperature || 0,
            humidity: data.humidity || 0,
            pressure: data.pressure || 0,
            description: "Current conditions from Open-Meteo",
        };
    }

    getLocationName(lat, lon) {
        // Simple location mapping for NZ coordinates
        const locations = {
            wellington: { lat: -40.9006, lon: 174.886, name: "Wellington" },
            christchurch: { lat: -43.532, lon: 172.6306, name: "Christchurch" },
            auckland: { lat: -36.8485, lon: 174.7633, name: "Auckland" },
            dunedin: { lat: -45.8788, lon: 170.5028, name: "Dunedin" },
        };

        // Find closest location
        let closest = null;
        let minDistance = Infinity;

        Object.values(locations).forEach((location) => {
            const distance = Math.sqrt(
                Math.pow(lat - location.lat, 2) +
                    Math.pow(lon - location.lon, 2)
            );
            if (distance < minDistance) {
                minDistance = distance;
                closest = location;
            }
        });

        return closest ? closest.name : `Lat: ${lat}, Lon: ${lon}`;
    }
}

module.exports = new WindDataService();
