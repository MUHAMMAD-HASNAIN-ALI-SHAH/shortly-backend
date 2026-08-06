const express = require("express");
const router = express.Router();
require("dotenv").config();
const protectedRoute = require("../middlwares/protected.middleware");
const { generateQrCodeForLink, getMyQrCodes } = require("../controllers/qr-code.controller");
const { qrCodeLimiter } = require("../config/limiter");
const { PlanMiddleware } = require("../middlwares/plan.middleware");

router.post("/", protectedRoute, qrCodeLimiter, PlanMiddleware, generateQrCodeForLink);
router.get("/", protectedRoute, getMyQrCodes);

module.exports = router;
