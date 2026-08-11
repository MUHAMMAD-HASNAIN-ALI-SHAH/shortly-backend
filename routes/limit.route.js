const express = require("express");
const router = express.Router();
require("dotenv").config();
const protectedRoute = require("../middlwares/protected.middleware");
const { getLimit } = require("../controllers/limit.controller");
const { PlanMiddleware } = require("../middlwares/plan.middleware");

router.get("/", protectedRoute, PlanMiddleware, getLimit);

module.exports = router;
