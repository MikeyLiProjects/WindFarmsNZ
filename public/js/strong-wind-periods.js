class StrongWindPeriodsApp {
    constructor() {
        this.charts = {};
        this.currentAnalysis = null;
        this.init();
    }

    init() {
        this.setDefaultDates();
        this.bindEvents();
    }

    setDefaultDates() {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);

        document.getElementById("endDate").value = endDate
            .toISOString()
            .split("T")[0];
        document.getElementById("startDate").value = startDate
            .toISOString()
            .split("T")[0];
    }

    bindEvents() {
        document.getElementById("analyzeBtn").addEventListener("click", () => {
            this.analyzeStrongWindPeriods();
        });

        document
            .getElementById("quickSelect")
            .addEventListener("change", (e) => {
                if (e.target.value) {
                    this.setDateRangeFromQuickSelect(parseInt(e.target.value));
                }
            });

        document
            .getElementById("searchEvents")
            .addEventListener("input", (e) => {
                this.filterEvents(e.target.value);
            });

        // Enter key support
        document
            .getElementById("startDate")
            .addEventListener("keypress", (e) => {
                if (e.key === "Enter") this.analyzeStrongWindPeriods();
            });
        document.getElementById("endDate").addEventListener("keypress", (e) => {
            if (e.key === "Enter") this.analyzeStrongWindPeriods();
        });
    }

    setDateRangeFromQuickSelect(days) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        document.getElementById("endDate").value = endDate
            .toISOString()
            .split("T")[0];
        document.getElementById("startDate").value = startDate
            .toISOString()
            .split("T")[0];
    }

    async analyzeStrongWindPeriods() {
        const startDate = document.getElementById("startDate").value;
        const endDate = document.getElementById("endDate").value;

        if (!startDate || !endDate) {
            this.showError("Please select both start and end dates.");
            return;
        }

        if (new Date(startDate) > new Date(endDate)) {
            this.showError("Start date must be before end date.");
            return;
        }

        this.showLoading(true);
        this.hideError();

        try {
            const response = await fetch(
                `/api/strong-wind-periods?startDate=${startDate}&endDate=${endDate}`
            );
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const analysis = await response.json();
            this.currentAnalysis = analysis;
            this.displayResults(analysis);
        } catch (error) {
            console.error("Error analyzing strong wind periods:", error);
            this.showError(
                "Failed to analyze strong wind periods. Please try again."
            );
        } finally {
            this.showLoading(false);
        }
    }

    displayResults(analysis) {
        this.displayAllPeriods(analysis.nzStrongWindPeriods);

        document.getElementById("results").classList.remove("hidden");
    }

    displayAllPeriods(periods) {
        const container = document.getElementById("allEvents");

        if (periods.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <p class="text-lg">No strong wind periods found in the selected period</p>
                </div>
            `;
            return;
        }

        // Add copy button at the top
        const copyButton = `
            <div class="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div class="flex items-center justify-between">
                    <div>
                        <h4 class="font-semibold text-blue-800">Copy Time Periods for Multi-Location Analysis</h4>
                        <p class="text-sm text-blue-600">Click the button to copy all time periods in the format needed for the Multi-Location page</p>
                    </div>
                    <button id="copyTimePeriodsBtn" class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                        Copy Time Periods
                    </button>
                </div>
            </div>
        `;

        // Calculate average duration
        const totalDuration = periods.reduce(
            (sum, period) => sum + period.durationHours,
            0
        );
        const avgDuration = totalDuration / periods.length;

        const statsSection = `
            <div class="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                    <div>
                        <p class="text-2xl font-bold text-green-600">${
                            periods.length
                        }</p>
                        <p class="text-sm text-green-700">Total Strong Wind Periods</p>
                    </div>
                    <div>
                        <p class="text-2xl font-bold text-green-600">${avgDuration.toFixed(
                            1
                        )}</p>
                        <p class="text-sm text-green-700">Average Duration (hours)</p>
                    </div>
                    <div>
                        <p class="text-2xl font-bold text-green-600">${totalDuration.toFixed(
                            1
                        )}</p>
                        <p class="text-sm text-green-700">Total Duration (hours)</p>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML =
            copyButton +
            statsSection +
            periods
                .map(
                    (period) => `
            <div class="wind-event-card bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div class="flex justify-between items-start">
                    <div class="flex-1">
                        <div class="flex items-center gap-3 mb-2">
                            <h4 class="font-semibold text-gray-800">${
                                period.windFarm
                            }</h4>
                        </div>
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                                <p class="text-gray-600">Start:</p>
                                <p class="font-medium">${this.formatDateTime(
                                    period.startTime
                                )}</p>
                            </div>
                            <div>
                                <p class="text-gray-600">End:</p>
                                <p class="font-medium">${this.formatDateTime(
                                    period.endTime
                                )}</p>
                            </div>
                            <div>
                                <p class="text-gray-600">Duration:</p>
                                <p class="font-medium">${period.durationHours.toFixed(
                                    1
                                )} hours</p>
                            </div>
                            <div>
                                <p class="text-gray-600">Max Speed (100m):</p>
                                <p class="font-medium text-red-600">${period.maxWindSpeed.toFixed(
                                    1
                                )} km/h</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `
                )
                .join("");

        // Add event listener for copy button
        document
            .getElementById("copyTimePeriodsBtn")
            .addEventListener("click", () => {
                this.copyTimePeriods(periods);
            });
    }

    copyTimePeriods(periods) {
        // Format periods for easy copying
        const formattedPeriods = periods
            .map((period) => {
                const startDate = new Date(period.startTime)
                    .toISOString()
                    .split("T")[0];
                const startTime = new Date(period.startTime)
                    .toISOString()
                    .split("T")[1]
                    .substring(0, 5);
                const endDate = new Date(period.endTime)
                    .toISOString()
                    .split("T")[0];
                const endTime = new Date(period.endTime)
                    .toISOString()
                    .split("T")[1]
                    .substring(0, 5);

                return `${startDate} ${startTime} - ${endDate} ${endTime}`;
            })
            .join("\n");

        // Copy to clipboard
        navigator.clipboard
            .writeText(formattedPeriods)
            .then(() => {
                // Show success message
                const button = document.getElementById("copyTimePeriodsBtn");
                const originalText = button.textContent;
                button.textContent = "Copied!";
                button.classList.remove("bg-blue-600", "hover:bg-blue-700");
                button.classList.add("bg-green-600");

                setTimeout(() => {
                    button.textContent = originalText;
                    button.classList.remove("bg-green-600");
                    button.classList.add("bg-blue-600", "hover:bg-blue-700");
                }, 2000);
            })
            .catch((err) => {
                console.error("Failed to copy: ", err);
                alert(
                    "Failed to copy to clipboard. Please select and copy the text manually."
                );
            });
    }

    filterEvents(searchTerm) {
        const eventCards = document.querySelectorAll(
            "#allEvents .wind-event-card"
        );
        const searchLower = searchTerm.toLowerCase();

        eventCards.forEach((card) => {
            const windFarmName = card
                .querySelector("h4")
                .textContent.toLowerCase();
            if (windFarmName.includes(searchLower)) {
                card.style.display = "block";
            } else {
                card.style.display = "none";
            }
        });
    }

    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString("en-NZ", {
            weekday: "short",
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    }

    formatDateTime(dateString) {
        return new Date(dateString).toLocaleString("en-NZ", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
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
        document.getElementById("error").classList.add("hidden");
    }
}

// Initialize the app when the page loads
document.addEventListener("DOMContentLoaded", () => {
    new StrongWindPeriodsApp();
});
