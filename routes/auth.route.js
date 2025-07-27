const express = require("express");
const router = express.Router();
require("dotenv").config();
const {
  redirectGoogle,
  googleCallback,
  verifyUser,
  logout,
  register,
  verifyEmail,
  login,
  changePassword,
} = require("../controllers/auth.controller");
const protectedRoute = require("../middlwares/protected.route");

// google authentication routes
router.get("/google", redirectGoogle);
router.get("/google/callback", googleCallback);

router.get("/verify", verifyUser);

router.get("/logout", logout);

router.route("/register").post(register);
router.route("/verify-email").post(verifyEmail);
router.route("/login").post(login);
router.route("/change-password").post(changePassword);

module.exports = router;
