const express = require("express");
const router = express.Router();
require("dotenv").config();
const protectedRoute = require("../middlwares/protected.middleware");
const { generateShortUrlForLink, getUserShortUrls, redirect, verifyPassword } = require("../controllers/short-url.controller");
const { shortUrlLimiter } = require("../config/limiter");
const { PlanMiddleware } = require("../middlwares/plan.middleware");

router.get("/", protectedRoute, getUserShortUrls);
router.post("/", protectedRoute, shortUrlLimiter, PlanMiddleware, generateShortUrlForLink);
router.get("/redirect", redirect);
router.post("/verify-password", verifyPassword);

module.exports = router;
