const express = require("express");
const router = express.Router();
require("dotenv").config();

const {
  generateQrCodeForLink,
  generateShortUrlForLink,
  editUrlTitle,
  getUserLinks,
  deleteUrlOrQr,
  getLimit,
} = require("../controllers/link.controller");


router.post("/qr", generateQrCodeForLink); // Create QR code link

router.post("/short", generateShortUrlForLink); // Create short URL link

router.put("/:id", editUrlTitle); // Update link title by ID

router.get("/", getUserLinks); // Get all user links (QR + short)

router.delete("/:id", deleteUrlOrQr); // Delete link (QR or short) by ID

router.get("/limit", getLimit); // Get QR code limit for user

module.exports = router;
