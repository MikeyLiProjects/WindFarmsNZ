class MultiLocationAnalysisApp {
    constructor() {
        this.currentAnalysis = null;
        this.init();
    }

    init() {
        this.bindEvents();
    }

    bindEvents() {
        document
            .getElementById("analyzeTimePeriodsBtn")
            .addEventListener("click", () => {
                this.analyzeTimePeriods();
            });
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
