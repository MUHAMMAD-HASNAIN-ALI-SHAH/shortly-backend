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

module.exports = router;
