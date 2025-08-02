class MultiLocationAnalysisApp {
    constructor() {
        this.charts = {};
        this.currentAnalysis = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.setupCharts();
        this.setDefaultDates();
    }

    bindEvents() {
        document
            .getElementById("analyzeEventBtn")
            .addEventListener("click", () => {
                this.analyzeWindEvent();
            });

        document
            .getElementById("analyzeTimePeriodsBtn")
            .addEventListener("click", () => {
                this.analyzeTimePeriods();
            });

        // Analysis mode toggle
        document
            .querySelectorAll('input[name="analysisMode"]')
            .forEach((radio) => {
                radio.addEventListener("change", (e) => {
                    this.toggleAnalysisMode(e.target.value);
                });
            });

        document.querySelectorAll(".date-preset").forEach((btn) => {
            btn.addEventListener("click", (e) => {
                const startDate = e.target.dataset.start;
                const endDate = e.target.dataset.end;
                document.getElementById("startDate").value = startDate;
                document.getElementById("endDate").value = endDate;
                this.analyzeWindEvent();
            });
        });

        // Enter key support for inputs
        document
            .getElementById("startDate")
            .addEventListener("keypress", (e) => {
                if (e.key === "Enter") this.analyzeWindEvent();
            });
        document.getElementById("endDate").addEventListener("keypress", (e) => {
            if (e.key === "Enter") this.analyzeWindEvent();
        });
        document
            .getElementById("threshold")
            .addEventListener("keypress", (e) => {
                if (e.key === "Enter") this.analyzeWindEvent();
            });
    }

    toggleAnalysisMode(mode) {
        if (mode === "dateRange") {
            document
                .getElementById("dateRangeSection")
                .classList.remove("hidden");
            document
                .getElementById("timePeriodsSection")
                .classList.add("hidden");
        } else {
            document.getElementById("dateRangeSection").classList.add("hidden");
            document
                .getElementById("timePeriodsSection")
                .classList.remove("hidden");
        }
    }

    setDefaultDates() {
        // Set default dates to last week
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 7);

        document.getElementById("startDate").value = startDate
            .toISOString()
            .split("T")[0];
        document.getElementById("endDate").value = endDate
            .toISOString()
            .split("T")[0];
    }

    async analyzeWindEvent() {
        const startDate = document.getElementById("startDate").value;
        const endDate = document.getElementById("endDate").value;
        const threshold = document.getElementById("threshold").value;

        if (!startDate || !endDate) {
            this.showError("Please enter both start and end dates.");
            return;
        }

        if (new Date(startDate) >= new Date(endDate)) {
            this.showError("Start date must be before end date.");
            return;
        }

        this.showLoading(true);
        this.hideError();

        try {
            const params = new URLSearchParams({
                startDate,
                endDate,
                threshold,
            });

            const response = await fetch(
                `/api/multi-location-analysis?${params}`
            );
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const analysis = await response.json();
            this.currentAnalysis = analysis;
            this.displayResults(analysis);
        } catch (error) {
            console.error("Error analyzing wind event:", error);
            this.showError(
                "Failed to analyze wind event. Please check your dates and try again."
            );
        } finally {
            this.showLoading(false);
        }
    }

    async analyzeTimePeriods() {
        const timePeriodsText = document
            .getElementById("timePeriodsInput")
            .value.trim();

        if (!timePeriodsText) {
            this.showError(
                "Please paste time periods from the Strong Wind Periods page."
            );
            return;
        }

        const timePeriods = this.parseTimePeriods(timePeriodsText);
        if (timePeriods.length === 0) {
            this.showError(
                "No valid time periods found. Please check the format."
            );
            return;
        }

        this.showLoading(true);
        this.hideError();

        try {
            const response = await fetch("/api/time-periods-analysis", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ timePeriods }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const analysis = await response.json();
            this.displayTimePeriodsResults(analysis, timePeriods);
        } catch (error) {
            console.error("Error analyzing time periods:", error);
            this.showError("Failed to analyze time periods. Please try again.");
        } finally {
            this.showLoading(false);
        }
    }

    parseTimePeriods(text) {
        const lines = text.split("\n").filter((line) => line.trim());
        const periods = [];

        for (const line of lines) {
            const match = line.match(
                /(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\s+-\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})/
            );
            if (match) {
                const [, startDate, startTime, endDate, endTime] = match;
                periods.push({
                    start: `${startDate}T${startTime}:00`,
                    end: `${endDate}T${endTime}:00`,
                });
            }
        }

        return periods;
    }

    displayTimePeriodsResults(analysis, timePeriods) {
        // Show time periods results section
        document
            .getElementById("timePeriodsResults")
            .classList.remove("hidden");
        document.getElementById("dateRangeResults").classList.add("hidden");

        // Update summary stats
        document.getElementById("totalTimePeriods").textContent =
            timePeriods.length;
        document.getElementById("totalFarmsAnalyzed").textContent =
            analysis.farms.length;

        // Calculate average period duration
        const totalDuration = timePeriods.reduce((sum, period) => {
            const start = new Date(period.start);
            const end = new Date(period.end);
            return sum + (end - start) / (1000 * 60 * 60); // hours
        }, 0);
        const avgDuration = totalDuration / timePeriods.length;
        document.getElementById("avgPeriodDuration").textContent =
            avgDuration.toFixed(1);

        // Create table headers
        const headerRow = document.getElementById("timePeriodHeaders");
        headerRow.innerHTML = timePeriods
            .map((period, index) => {
                const start = new Date(period.start);
                const end = new Date(period.end);
                const duration = (end - start) / (1000 * 60 * 60);
                return `<th class="px-4 py-2 text-left text-xs">
                Period ${index + 1}<br>
                <span class="text-gray-500">${duration.toFixed(1)}h</span>
            </th>`;
            })
            .join("");

        // Create table body
        const tableBody = document.getElementById("timePeriodsTable");
        tableBody.innerHTML = "";

        analysis.farms.forEach((farm) => {
            const row = document.createElement("tr");
            row.className = "hover:bg-gray-50";

            // Calculate overall average for this farm
            const validSpeeds = farm.averageSpeeds.filter(
                (speed) => speed !== null
            );
            const overallAverage =
                validSpeeds.length > 0
                    ? validSpeeds.reduce((sum, speed) => sum + speed, 0) /
                      validSpeeds.length
                    : 0;

            row.innerHTML = `
                <td class="px-4 py-2 font-semibold">${farm.name}</td>
                ${farm.averageSpeeds
                    .map(
                        (speed) =>
                            `<td class="px-4 py-2 text-center ${
                                speed === null ? "text-gray-400" : "font-medium"
                            }">${
                                speed === null ? "N/A" : speed.toFixed(1)
                            }</td>`
                    )
                    .join("")}
                <td class="px-4 py-2 text-center font-bold text-blue-600">${overallAverage.toFixed(
                    1
                )}</td>
            `;

            tableBody.appendChild(row);
        });

        document.getElementById("results").classList.remove("hidden");
    }

    displayResults(analysis) {
        // Show date range results section
        document.getElementById("timePeriodsResults").classList.add("hidden");
        document.getElementById("dateRangeResults").classList.remove("hidden");

        this.updateWindFarmRanking(analysis.eventSummary.windSpeedRanking);

        document.getElementById("results").classList.remove("hidden");
    }

    updateEventSummary(eventSummary) {
        document.getElementById("totalFarms").textContent =
            eventSummary.totalFarms;
        document.getElementById("farmsAffected").textContent =
            eventSummary.farmsWithStrongWinds;
        document.getElementById(
            "maxWindSpeed"
        ).textContent = `${eventSummary.maxWindSpeed.toFixed(1)} km/h`;
        document.getElementById(
            "avgWindSpeed"
        ).textContent = `${eventSummary.overallStats.averageWindSpeedAcrossAllFarms.toFixed(
            1
        )} km/h`;

        document.getElementById(
            "eventPeriod"
        ).textContent = `Event Period: ${eventSummary.startDate} to ${eventSummary.endDate}`;
        document.getElementById(
            "maxWindLocation"
        ).textContent = `Highest Wind: ${
            eventSummary.maxWindSpeedLocation
        } (${eventSummary.maxWindSpeed.toFixed(1)} km/h)`;
    }

    updateWindFarmRanking(ranking) {
        const tableBody = document.getElementById("rankingTable");
        tableBody.innerHTML = "";

        ranking.forEach((farm, index) => {
            const row = document.createElement("tr");
            row.className = index < 3 ? "bg-yellow-50" : "hover:bg-gray-50";

            row.innerHTML = `
                <td class="px-4 py-2 font-semibold">${farm.rank}</td>
                <td class="px-4 py-2">${farm.farmName}</td>
                <td class="px-4 py-2 font-bold text-red-600">${farm.maxWindSpeed.toFixed(
                    1
                )} km/h</td>
                <td class="px-4 py-2">${farm.averageWindSpeed.toFixed(
                    1
                )} km/h</td>
            `;

            tableBody.appendChild(row);
        });
    }

    setupCharts() {
        // Wind Speed Distribution Chart
        const windSpeedCtx = document
            .getElementById("windSpeedChart")
            .getContext("2d");
        this.charts.windSpeed = new Chart(windSpeedCtx, {
            type: "bar",
            data: {
                labels: [],
                datasets: [
                    {
                        label: "Max Wind Speed (km/h)",
                        data: [],
                        backgroundColor: "rgba(239, 68, 68, 0.8)",
                        borderColor: "rgb(239, 68, 68)",
                        borderWidth: 1,
                    },
                    {
                        label: "Average Wind Speed (km/h)",
                        data: [],
                        backgroundColor: "rgba(59, 130, 246, 0.8)",
                        borderColor: "rgb(59, 130, 246)",
                        borderWidth: 1,
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
                            text: "Wind Farms",
                        },
                    },
                },
            },
        });

        // Regional Impact Chart
        const regionalCtx = document
            .getElementById("regionalChart")
            .getContext("2d");
        this.charts.regional = new Chart(regionalCtx, {
            type: "doughnut",
            data: {
                labels: [],
                datasets: [
                    {
                        data: [],
                        backgroundColor: [
                            "rgba(239, 68, 68, 0.8)",
                            "rgba(245, 101, 101, 0.8)",
                            "rgba(251, 146, 60, 0.8)",
                            "rgba(251, 191, 36, 0.8)",
                            "rgba(34, 197, 94, 0.8)",
                            "rgba(59, 130, 246, 0.8)",
                            "rgba(147, 51, 234, 0.8)",
                            "rgba(236, 72, 153, 0.8)",
                        ],
                        borderWidth: 2,
                        borderColor: "#fff",
                    },
                ],
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: "bottom",
                    },
                },
            },
        });
    }

    updateCharts(analysis) {
        // Update Wind Speed Distribution Chart
        const ranking = analysis.eventSummary.windSpeedRanking;
        const labels = ranking.map(
            (farm) => farm.farmName.substring(0, 15) + "..."
        );
        const maxSpeeds = ranking.map((farm) => farm.maxWindSpeed);
        const avgSpeeds = ranking.map((farm) => farm.averageWindSpeed);

        this.charts.windSpeed.data.labels = labels;
        this.charts.windSpeed.data.datasets[0].data = maxSpeeds;
        this.charts.windSpeed.data.datasets[1].data = avgSpeeds;
        this.charts.windSpeed.update();

        // Update Regional Impact Chart
        const regionalData = this.calculateRegionalData(ranking);
        this.charts.regional.data.labels = regionalData.labels;
        this.charts.regional.data.datasets[0].data = regionalData.data;
        this.charts.regional.update();
    }

    calculateRegionalData(ranking) {
        const regionalStats = {};

        ranking.forEach((farm) => {
            if (!regionalStats[farm.region]) {
                regionalStats[farm.region] = {
                    count: 0,
                    totalMaxSpeed: 0,
                    totalAvgSpeed: 0,
                };
            }

            regionalStats[farm.region].count++;
            regionalStats[farm.region].totalMaxSpeed += farm.maxWindSpeed;
            regionalStats[farm.region].totalAvgSpeed += farm.averageWindSpeed;
        });

        const labels = Object.keys(regionalStats);
        const data = labels.map((region) => {
            const stats = regionalStats[region];
            return (stats.totalMaxSpeed / stats.count).toFixed(1);
        });

        return { labels, data };
    }

    displayRecommendations(recommendations) {
        const container = document.getElementById("recommendations");
        container.innerHTML = "";

        if (recommendations.length === 0) {
            container.innerHTML =
                '<p class="text-gray-600">No specific recommendations for this event.</p>';
            return;
        }

        recommendations.forEach((rec) => {
            const colorClass =
                {
                    warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
                    danger: "bg-red-50 border-red-200 text-red-800",
                    info: "bg-blue-50 border-blue-200 text-blue-800",
                }[rec.type] || "bg-gray-50 border-gray-200 text-gray-800";

            const impactBadge =
                {
                    "Grid-wide": "bg-purple-100 text-purple-800",
                    Regional: "bg-orange-100 text-orange-800",
                    Safety: "bg-red-100 text-red-800",
                    Operational: "bg-green-100 text-green-800",
                }[rec.impact] || "bg-gray-100 text-gray-800";

            const element = document.createElement("div");
            element.className = `border rounded-lg p-4 ${colorClass}`;
            element.innerHTML = `
                <div class="flex items-start justify-between">
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
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${impactBadge}">
                        ${rec.impact}
                    </span>
                </div>
            `;
            container.appendChild(element);
        });
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
    new MultiLocationAnalysisApp();
});
