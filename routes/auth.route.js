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
  getRecoveryLink,
  resetPassword,
} = require("../controllers/auth.controller");
const protectedRoute = require("../middlwares/protected.middleware");

// google authentication routes
router.get("/google", redirectGoogle);
router.get("/google/callback", googleCallback);

// verify and logout routes
router.get("/verify", protectedRoute, verifyUser);  // verify user route
router.get("/logout", logout);  // logout route

// registers routes
router.route("/register").post(register);  // user registration route
router.route("/verify-email").post(verifyEmail);  // email verification route on registration

// login routes
router.route("/login").post(login);  // user login route

// reset password route
router.route("/get-recovery-link").post(getRecoveryLink);
router.route("/reset-password").post(resetPassword);

module.exports = router;
