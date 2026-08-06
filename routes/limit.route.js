const express = require("express");
const router = express.Router();
require("dotenv").config();
const protectedRoute = require("../middlwares/protected.middleware");
const { getLimit } = require("../controllers/limit.controller");

router.get("/", protectedRoute, getLimit);

module.exports = router;
