const express = require("express");
const router = express.Router();
require("dotenv").config();
const protectedRoute = require("../middlwares/protected.route");
const { getLimit } = require("../controllers/limit.controller");

router.get("/", protectedRoute, getLimit);
module.exports = router;
