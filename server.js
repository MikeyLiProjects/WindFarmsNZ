const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const windDataService = require("./services/wind-data-service");
const windAnalysisService = require("./services/wind-analysis-service");
const multiLocationAnalysisService = require("./services/multi-location-analysis-service");
const strongWindPeriodsService = require("./services/strong-wind-periods-service");
const timePeriodsAnalysisService = require("./services/time-periods-analysis-service");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Routes
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/strong-wind-periods", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "strong-wind-periods.html"));
});

app.get("/multi-location", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "multi-location.html"));
});

// API Routes
app.get("/api/wind-data/:lat/:lon", async (req, res) => {
    try {
        const { lat, lon } = req.params;
        const data = await windDataService.getWindData(lat, lon);
        res.json(data);
    } catch (error) {
        console.error("Error fetching wind data:", error);
        res.status(500).json({ error: "Failed to fetch wind data" });
    }
});

app.get("/api/analysis/:lat/:lon", async (req, res) => {
    try {
        const { lat, lon } = req.params;
        const analysis = await windAnalysisService.analyzeWindPatterns(
            lat,
            lon
        );
        res.json(analysis);
    } catch (error) {
        console.error("Error analyzing wind patterns:", error);
        res.status(500).json({ error: "Failed to analyze wind patterns" });
    }
});

// New multi-location analysis endpoint
app.get("/api/multi-location-analysis", async (req, res) => {
    try {
        const { startDate, endDate, threshold = 60 } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                error: "startDate and endDate are required parameters",
            });
        }

        console.log(
            `Multi-location analysis requested for period: ${startDate} to ${endDate}`
        );

        const analysis =
            await multiLocationAnalysisService.analyzeStrongWindEvent(
                startDate,
                endDate,
                parseInt(threshold)
            );

        res.json(analysis);
    } catch (error) {
        console.error("Error in multi-location analysis:", error);
        res.status(500).json({
            error: "Failed to perform multi-location analysis",
        });
    }
});

app.get("/api/wind-farms", async (req, res) => {
    try {
        const windFarms = await multiLocationAnalysisService.loadWindFarms();
        res.json(windFarms);
    } catch (error) {
        console.error("Error loading wind farms:", error);
        res.status(500).json({ error: "Failed to load wind farms" });
    }
});

// Strong wind periods analysis endpoint
app.get("/api/strong-wind-periods", async (req, res) => {
    try {
        const { startDate, endDate, days } = req.query;

        let analysis;

        if (days) {
            // Get analysis for last N days
            analysis = await strongWindPeriodsService.getStrongWindSummary(
                parseInt(days)
            );
        } else if (startDate && endDate) {
            // Get analysis for specific date range
            analysis = await strongWindPeriodsService.analyzeStrongWindPeriods(
                startDate,
                endDate
            );
        } else {
            // Default to last 7 days
            analysis = await strongWindPeriodsService.getStrongWindSummary(7);
        }

        res.json(analysis);
    } catch (error) {
        console.error("Error analyzing strong wind periods:", error);
        res.status(500).json({
            error: "Failed to analyze strong wind periods",
        });
    }
});

// Time periods analysis endpoint
app.post("/api/time-periods-analysis", async (req, res) => {
    try {
        const { timePeriods } = req.body;

        if (
            !timePeriods ||
            !Array.isArray(timePeriods) ||
            timePeriods.length === 0
        ) {
            return res.status(400).json({
                error: "timePeriods array is required and must not be empty",
            });
        }

        console.log(
            `Time periods analysis requested for ${timePeriods.length} periods`
        );

        const analysis = await timePeriodsAnalysisService.analyzeTimePeriods(
            timePeriods
        );

        res.json(analysis);
    } catch (error) {
        console.error("Error in time periods analysis:", error);
        res.status(500).json({
            error: "Failed to perform time periods analysis",
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Wind Analysis Server running on http://localhost:${PORT}`);
    console.log(
        "Using Open-Meteo API for historical weather data (free, no API key required)"
    );
});
