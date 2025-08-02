class WindAnalysisApp {
    constructor() {
        this.charts = {};
        this.currentAnalysis = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.setupCharts();
    }

    bindEvents() {
        document.getElementById("analyzeBtn").addEventListener("click", () => {
            this.analyzeWindPatterns();
        });

        document.querySelectorAll(".preset-location").forEach((btn) => {
            btn.addEventListener("click", (e) => {
                const lat = e.target.dataset.lat;
                const lon = e.target.dataset.lon;
                document.getElementById("latitude").value = lat;
                document.getElementById("longitude").value = lon;
                this.analyzeWindPatterns();
            });
        });

        // Enter key support for inputs
        document
            .getElementById("latitude")
            .addEventListener("keypress", (e) => {
                if (e.key === "Enter") this.analyzeWindPatterns();
            });
        document
            .getElementById("longitude")
            .addEventListener("keypress", (e) => {
                if (e.key === "Enter") this.analyzeWindPatterns();
            });
    }

    async analyzeWindPatterns() {
        const lat = document.getElementById("latitude").value;
        const lon = document.getElementById("longitude").value;

        if (!lat || !lon) {
            this.showError("Please enter both latitude and longitude values.");
            return;
        }

        this.showLoading(true);
        this.hideError();

        try {
            const response = await fetch(`/api/analysis/${lat}/${lon}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const analysis = await response.json();
            this.currentAnalysis = analysis;
            this.displayResults(analysis);
        } catch (error) {
            console.error("Error analyzing wind patterns:", error);
            this.showError(
                "Failed to analyze wind patterns. Please check your coordinates and try again."
            );
        } finally {
            this.showLoading(false);
        }
    }

    displayResults(analysis) {
        this.updateSummaryCards(analysis);
        this.updateCharts(analysis);
        this.displayStrongWindPeriods(analysis.strongWindPeriods);
        this.createWindRose(analysis.windRose);
        this.displayRecommendations(analysis.recommendations);

        document.getElementById("results").classList.remove("hidden");
    }

    updateSummaryCards(analysis) {
        document.getElementById(
            "currentWindSpeed"
        ).textContent = `${analysis.summary.averageWindSpeed.toFixed(1)} km/h`;
        document.getElementById("currentLocation").textContent =
            analysis.location.name ||
            `Lat: ${analysis.location.lat}, Lon: ${analysis.location.lon}`;
        document.getElementById(
            "strongWindPercentage"
        ).textContent = `${analysis.summary.strongWindPercentage.toFixed(1)}%`;
        document.getElementById(
            "maxWindSpeed"
        ).textContent = `${analysis.summary.maxWindSpeed.toFixed(1)} km/h`;
        document.getElementById(
            "avgWindSpeed"
        ).textContent = `${analysis.summary.averageWindSpeed.toFixed(1)} km/h`;

        // Additional wind data cards
        document.getElementById(
            "maxWindSpeed100m"
        ).textContent = `${analysis.summary.maxWindSpeed100m.toFixed(1)} km/h`;
        document.getElementById(
            "maxWindGusts"
        ).textContent = `${analysis.summary.maxWindGusts.toFixed(1)} km/h`;

        const heightRatio = analysis.heightComparison
            ? analysis.heightComparison.speedRatio
            : 0;
        document.getElementById(
            "heightSpeedRatio"
        ).textContent = `${heightRatio.toFixed(2)}x`;
    }

    setupCharts() {
        // Wind Speed Over Time Chart
        const windSpeedCtx = document
            .getElementById("windSpeedChart")
            .getContext("2d");
        this.charts.windSpeed = new Chart(windSpeedCtx, {
            type: "line",
            data: {
                labels: [],
                datasets: [
                    {
                        label: "Wind Speed (10m) km/h",
                        data: [],
                        borderColor: "rgb(59, 130, 246)",
                        backgroundColor: "rgba(59, 130, 246, 0.1)",
                        tension: 0.1,
                    },
                    {
                        label: "Wind Speed (100m) km/h",
                        data: [],
                        borderColor: "rgb(147, 51, 234)",
                        backgroundColor: "rgba(147, 51, 234, 0.1)",
                        tension: 0.1,
                    },
                    {
                        label: "Wind Gusts km/h",
                        data: [],
                        borderColor: "rgb(99, 102, 241)",
                        backgroundColor: "rgba(99, 102, 241, 0.1)",
                        tension: 0.1,
                    },
                ],
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: true,
                    },
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: "Wind Speed (km/h)",
                        },
                    },
                    x: {
                        title: {
                            display: true,
                            text: "Time",
                        },
                    },
                },
            },
        });

        // Hourly Distribution Chart
        const hourlyCtx = document
            .getElementById("hourlyChart")
            .getContext("2d");
        this.charts.hourly = new Chart(hourlyCtx, {
            type: "bar",
            data: {
                labels: [],
                datasets: [
                    {
                        label: "Average Wind Speed (10m)",
                        data: [],
                        backgroundColor: "rgba(34, 197, 94, 0.8)",
                        borderColor: "rgb(34, 197, 94)",
                        borderWidth: 1,
                    },
                    {
                        label: "Average Wind Speed (100m)",
                        data: [],
                        backgroundColor: "rgba(147, 51, 234, 0.8)",
                        borderColor: "rgb(147, 51, 234)",
                        borderWidth: 1,
                    },
                    {
                        label: "Strong Wind %",
                        data: [],
                        backgroundColor: "rgba(249, 115, 22, 0.8)",
                        borderColor: "rgb(249, 115, 22)",
                        borderWidth: 1,
                        yAxisID: "y1",
                    },
                ],
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: true,
                    },
                },
                scales: {
                    y: {
                        type: "linear",
                        display: true,
                        position: "left",
                        title: {
                            display: true,
                            text: "Wind Speed (km/h)",
                        },
                    },
                    y1: {
                        type: "linear",
                        display: true,
                        position: "right",
                        title: {
                            display: true,
                            text: "Strong Wind %",
                        },
                        grid: {
                            drawOnChartArea: false,
                        },
                    },
                    x: {
                        title: {
                            display: true,
                            text: "Hour of Day",
                        },
                    },
                },
            },
        });
    }

    updateCharts(analysis) {
        // Update Wind Speed Over Time Chart
        const allData = [
            ...(analysis.historical || []),
            ...(analysis.forecast || []),
        ];
        const sortedData = allData.sort(
            (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
        );

        const labels = sortedData.map((d) =>
            new Date(d.timestamp).toLocaleString()
        );
        const windSpeeds10m = sortedData.map((d) => d.windSpeedKmh);
        const windSpeeds100m = sortedData.map((d) => d.windSpeed100mKmh || 0);
        const windGusts = sortedData.map((d) => d.windGustsKmh || 0);

        this.charts.windSpeed.data.labels = labels;
        this.charts.windSpeed.data.datasets[0].data = windSpeeds10m;
        this.charts.windSpeed.data.datasets[1].data = windSpeeds100m;
        this.charts.windSpeed.data.datasets[2].data = windGusts;
        this.charts.windSpeed.update();

        // Update Hourly Distribution Chart
        const hourlyLabels = Object.keys(analysis.hourlyDistribution).map(
            (h) => `${h}:00`
        );
        const hourlyAvgSpeeds10m = Object.values(
            analysis.hourlyDistribution
        ).map((h) => h.avgWindSpeed);
        const hourlyAvgSpeeds100m = Object.values(
            analysis.hourlyDistribution
        ).map((h) => h.avgWindSpeed100m || 0);
        const hourlyStrongWindPercents = Object.values(
            analysis.hourlyDistribution
        ).map((h) => h.strongWindPercentage);

        this.charts.hourly.data.labels = hourlyLabels;
        this.charts.hourly.data.datasets[0].data = hourlyAvgSpeeds10m;
        this.charts.hourly.data.datasets[1].data = hourlyAvgSpeeds100m;
        this.charts.hourly.data.datasets[2].data = hourlyStrongWindPercents;
        this.charts.hourly.update();
    }

    displayStrongWindPeriods(periods) {
        const container = document.getElementById("strongWindPeriods");
        container.innerHTML = "";

        if (periods.length === 0) {
            container.innerHTML =
                '<p class="text-gray-600">No strong wind periods detected in the analyzed timeframe.</p>';
            return;
        }

        periods.forEach((period, index) => {
            const duration = this.formatDuration(period.duration);
            const startTime = new Date(period.start).toLocaleString();
            const endTime = new Date(period.end).toLocaleString();

            const periodElement = document.createElement("div");
            periodElement.className =
                "bg-orange-50 border border-orange-200 rounded-lg p-4";
            periodElement.innerHTML = `
                <div class="flex justify-between items-start">
                    <div>
                        <h4 class="font-semibold text-orange-800">Period ${
                            index + 1
                        }</h4>
                        <p class="text-sm text-gray-600">Duration: ${duration}</p>
                        <p class="text-sm text-gray-600">Start: ${startTime}</p>
                        <p class="text-sm text-gray-600">End: ${endTime}</p>
                    </div>
                    <div class="text-right">
                        <p class="text-lg font-bold text-orange-600">${period.maxWindSpeed.toFixed(
                            1
                        )} km/h</p>
                        <p class="text-sm text-gray-600">Max Speed (10m)</p>
                        <p class="text-sm text-gray-600">Avg: ${period.avgWindSpeed.toFixed(
                            1
                        )} km/h</p>
                        ${
                            period.maxWindSpeed100m
                                ? `<p class="text-sm text-purple-600">Max 100m: ${period.maxWindSpeed100m.toFixed(
                                      1
                                  )} km/h</p>`
                                : ""
                        }
                        ${
                            period.maxWindGusts
                                ? `<p class="text-sm text-indigo-600">Max Gust: ${period.maxWindGusts.toFixed(
                                      1
                                  )} km/h</p>`
                                : ""
                        }
                    </div>
                </div>
            `;
            container.appendChild(periodElement);
        });
    }

    createWindRose(windRoseData) {
        const container = document.getElementById("windRose");
        container.innerHTML = "";

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

        directions.forEach((direction, index) => {
            const angle = index * 22.5 * (Math.PI / 180);
            const data = windRoseData[direction];
            const percentage = data.strongWindPercentage;
            const avgSpeed = data.avgSpeed;

            const element = document.createElement("div");
            element.className = "wind-direction";
            element.style.left = "50%";
            element.style.top = "50%";
            element.style.transform = `translate(-50%, -50%) rotate(${angle}rad) translateY(-120px)`;
            element.innerHTML = `
                <div class="text-xs font-semibold">${direction}</div>
                <div class="text-xs text-gray-600">${percentage.toFixed(
                    1
                )}%</div>
                <div class="text-xs text-gray-500">${avgSpeed.toFixed(
                    1
                )} km/h</div>
            `;
            container.appendChild(element);
        });

        // Add center point
        const center = document.createElement("div");
        center.className =
            "absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-blue-600 rounded-full";
        container.appendChild(center);
    }

    displayRecommendations(recommendations) {
        const container = document.getElementById("recommendations");
        container.innerHTML = "";

        if (recommendations.length === 0) {
            container.innerHTML =
                '<p class="text-gray-600">No specific recommendations at this time.</p>';
            return;
        }

        recommendations.forEach((rec) => {
            const colorClass =
                {
                    warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
                    danger: "bg-red-50 border-red-200 text-red-800",
                    info: "bg-blue-50 border-blue-200 text-blue-800",
                }[rec.type] || "bg-gray-50 border-gray-200 text-gray-800";

            const element = document.createElement("div");
            element.className = `border rounded-lg p-4 ${colorClass}`;
            element.innerHTML = `
                <div class="flex items-start">
                    <div class="flex-shrink-0">
                        <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                        </svg>
                    </div>
                    <div class="ml-3">
                        <p class="text-sm font-medium">${rec.message}</p>
                    </div>
                </div>
            `;
            container.appendChild(element);
        });
    }

    formatDuration(duration) {
        // Handle the new duration object format from backend
        if (
            duration &&
            typeof duration === "object" &&
            duration.hours !== undefined
        ) {
            // New format: { hours: number, minutes: number, totalMinutes: number, totalMilliseconds: number }
            const hours = duration.hours || 0;
            const minutes = duration.minutes || 0;

            if (hours > 0) {
                return `${hours}h ${minutes}m`;
            } else {
                return `${minutes}m`;
            }
        } else if (duration && typeof duration.asHours === "function") {
            // Legacy Moment.js duration object (fallback)
            const hours = Math.floor(duration.asHours());
            const minutes = Math.floor(duration.asMinutes()) % 60;

            if (hours > 0) {
                return `${hours}h ${minutes}m`;
            } else {
                return `${minutes}m`;
            }
        } else if (typeof duration === "number") {
            // Duration in milliseconds
            const hours = Math.floor(duration / (1000 * 60 * 60));
            const minutes = Math.floor(
                (duration % (1000 * 60 * 60)) / (1000 * 60)
            );

            if (hours > 0) {
                return `${hours}h ${minutes}m`;
            } else {
                return `${minutes}m`;
            }
        } else {
            // Fallback
            return "Unknown duration";
        }
    }

    showLoading(show) {
        const loading = document.getElementById("loading");
        if (show) {
            loading.classList.remove("hidden");
        } else {
            loading.classList.add("hidden");
        }
    }

    showError(message) {
        const error = document.getElementById("error");
        const errorMessage = document.getElementById("errorMessage");
        errorMessage.textContent = message;
        error.classList.remove("hidden");
    }

    hideError() {
        const error = document.getElementById("error");
        error.classList.add("hidden");
    }
}

// Initialize the application when the DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
    new WindAnalysisApp();
});
