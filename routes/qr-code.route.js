const express = require("express");
const router = express.Router();
require("dotenv").config();
const protectedRoute = require("../middlwares/protected.route");
const { generateQrCodeForLink, getMyQrCodes } = require("../controllers/qr-code.controller");
const { qrCodeLimiter } = require("../config/limiter");

router.post("/", protectedRoute, qrCodeLimiter, generateQrCodeForLink);
router.get("/", protectedRoute, getMyQrCodes);
module.exports = router;
