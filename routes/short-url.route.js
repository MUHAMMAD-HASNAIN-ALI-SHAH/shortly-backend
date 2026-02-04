const express = require("express");
const router = express.Router();
require("dotenv").config();
const protectedRoute = require("../middlwares/protected.route");
const { generateShortUrlForLink, getUserShortUrls, redirect, verifyPassword } = require("../controllers/short-url.controller");
const { shortUrlLimiter } = require("../config/limiter");

router.get("/", protectedRoute, getUserShortUrls);
router.post("/", protectedRoute, shortUrlLimiter, generateShortUrlForLink);
router.get("/redirect", redirect);
router.post("/verify-password", verifyPassword);

module.exports = router;
