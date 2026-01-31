const express = require("express");
const router = express.Router();
require("dotenv").config();
const protectedRoute = require("../middlwares/protected.route");
const { generateQrCodeForLink, getMyQrCodes } = require("../controllers/qr-code.controller");

router.post("/", protectedRoute, generateQrCodeForLink);
router.get("/", protectedRoute, getMyQrCodes);
module.exports = router;
