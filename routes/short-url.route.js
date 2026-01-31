const express = require("express");
const router = express.Router();
require("dotenv").config();
const protectedRoute = require("../middlwares/protected.route");
const {generateShortUrlForLink, getUserShortUrls} = require("../controllers/short-url.controller");

router.get("/", protectedRoute, getUserShortUrls);
router.post("/", protectedRoute, generateShortUrlForLink);

module.exports = router;
