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
  requestPasswordReset,
  checkPasswordResetDetails,
  forgotPasswordChangePassword,
} = require("../controllers/auth.controller");
const protectedRoute = require("../middlwares/protected.route");

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

// forgot password routes
router.route("/request-password-reset").post(requestPasswordReset);  // request password reset route
router.route("/check-password-reset-details").get(checkPasswordResetDetails);  // check password reset details route
router.route("/forgot-password-change-password").post(forgotPasswordChangePassword);  // forgot password change password route

module.exports = router;
