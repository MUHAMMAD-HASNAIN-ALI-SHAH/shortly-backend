const { default: axios } = require("axios");
const User = require("../models/user.model");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const { sendCode, getResetPasswordEmail } = require("../config/email");
const Code = require("../models/code.schema");
const Plan = require("../models/plan.model");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD,
  },
});

const redirectGoogle = (req, res) => {
  const redirectUri =
    "https://accounts.google.com/o/oauth2/v2/auth?" +
    new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: `${process.env.GOOGLE_REDIRECT_URI}/api/v1/auth/google/callback`,
      response_type: "code",
      scope: "email profile",
      access_type: "offline",
      prompt: "consent",
    });
  res.redirect(redirectUri);
};

const googleCallback = async (req, res) => {
  const code = req.query.code;

  if (!code) return res.status(400).send("Missing code");

  try {
    const tokenRes = await axios.post(
      "https://oauth2.googleapis.com/token",
      new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${process.env.GOOGLE_REDIRECT_URI}/api/v1/auth/google/callback`,
        grant_type: "authorization_code",
      }),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );

    const { access_token } = tokenRes.data;

    const userRes = await axios.get(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      }
    );

    const { email, name, picture, id: googleId } = userRes.data;

    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        email,
        username: name,
        picture,
        googleId,
        emailVerified: true,
      });
      await Plan.create({
        userId: user._id,
        planType: "free",
        urls: 10,
        qrCodes: 5,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
    }

    req.session.user = {
      username: user.username,
      email: user.email,
      picture: user.picture,
    };

    res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
  } catch (err) {
    console.error("OAuth Error", err.response?.data || err.message);
    res.status(500).send("Authentication failed");
  }
};

const verifyUser = (req, res) => {
  try {
    if (req.session.user) {
      return res.status(200).json({ user: req.session.user });
    }
    return res.status(401).json({ message: "Not authenticated" });
  } catch (error) {
    console.error("Verification Error", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).send("Failed to logout");
    res.clearCookie("connect.sid");
    res.redirect("/");
  });
};

const register = async (req, res) => {
  try {
    let { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ msg: "Please fill in all fields" });
    }

    email = email.trim().toLowerCase();

    const existingUser = await User.findOne({ email });
    if (existingUser && !existingUser.emailVerified) {
      await User.deleteOne({ _id: existingUser._id });
      await Code.deleteOne({ userId: existingUser._id });
    }

    if (existingUser && existingUser.emailVerified) {
      return res.status(400).json({ msg: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      username,
      email,
      password: hashedPassword,
    });

    const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();

    await Code.create({
      userId: newUser._id,
      code: verificationCode,
      email,
    });

    await transporter.sendMail({
      from: `"Shortly" <${process.env.SMTP_EMAIL}>`,
      to: email,
      subject: "Your Verification Code",
      html: sendCode(verificationCode),
    });

    return res.status(201).json({ msg: "User registered successfully" });
  } catch (err) {
    console.error("Register Error:", err.message);
    return res.status(500).json({ msg: "Internal Server Error" });
  }
};

const verifyEmail = async (req, res) => {
  try {
    let { code, email } = req.body;

    if (!code) {
      return res
        .status(400)
        .json({ msg: "Please provide a verification code" });
    }

    const verification = await Code.findOne({ code, email });

    if (!verification) {
      return res
        .status(400)
        .json({ msg: "Invalid or expired verification code" });
    }

    await User.updateOne({ _id: verification.userId }, { emailVerified: true });
    await Code.deleteOne({ _id: verification._id });

    return res.status(201).json({ msg: "Email verified successfully" });
  } catch (err) {
    console.error("Email Verification Error:", err.message);
    return res.status(500).json({ msg: "Internal Server Error" });
  }
};

const login = async (req, res) => {
  try {
    let { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ msg: "Please fill in all fields" });
    }

    email = email.trim().toLowerCase();

    const user = await User.findOne({ email });

    if (!user || !user.emailVerified) {
      return res
        .status(400)
        .json({ msg: "User does not exist or email not verified" });
    }

    if (!user.password) {
      return res.status(400).json({ msg: "User signed up with Google" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: "Invalid credentials" });
    }

    req.session.user = {
      username: user.username,
      email: user.email,
      picture: user.picture,
    };

    return res.status(200).json({ user: req.session.user });
  } catch (err) {
    console.error("Login Controller Error:", err.message);
    return res.status(500).json({ msg: "Internal Server Error" });
  }
};

const codeForForgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ msg: "Please provide an email" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: "User does not exist" });
    }

    const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();

    await Code.deleteMany({ userId: user._id });

    await Code.create({
      userId: user._id,
      code: verificationCode,
      email,
    });

    await transporter.sendMail({
      from: `"Shortly" <${process.env.SMTP_EMAIL}>`,
      to: email,
      subject: "Forgot Password Verification Code",
      html: sendCode(verificationCode),
    });

    return res.status(200).json();
  } catch (err) {
    console.error("Forgot Password Error:", err.message);
    return res.status(500).json({ msg: "Internal Server Error" });
  }
};

const changePassword = async (req, res) => {
  try {
    const { password, newPassword } = req.body;
    const { email } = req.session.user;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: "Email not found" });
    }

    if (!user.password) {
      return res.status(400).json({ msg: "Invalid current password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: "Invalid current password" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;
    await user.save();

    return res.status(200).json({ msg: "Password updated successfully" });
  } catch (err) {
    console.error("Change Password Error:", err.message);
    return res.status(500).json({ msg: "Internal Server Error" });
  }
};

const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    // Validate input
    if (!email) return res.status(400).json({ msg: "Email is required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ msg: "User not found" });

    // Generate 4-digit numeric code
    const code = Math.floor(1000 + Math.random() * 9000).toString();

    // delete previous code if exists
    await Code.deleteMany({ userId: user._id });

    // Store code and 10-minute expiry
    await Code.create({
      userId: user._id,
      code,
      email,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    // Send email
    await transporter.sendMail({
      from: `"Shortly" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Reset Your Password - Shortly",
      html: getResetPasswordEmail(user._id, code),
    });

    return res.status(200).json({ msg: "Reset code sent to your email." });
  } catch (err) {
    console.error("Error in requestPasswordReset:", err.message);
    return res.status(500).json({ msg: "Internal Server Error" });
  }
};

const checkPasswordResetDetails = async (req, res) => {
  try {
    const { userId, code } = req.query;

    // Validate input
    if (!userId || !code) {
      return res.status(400).json({ msg: "User ID and code are required" });
    }

    const resetCode = await Code.findOne({ userId, code });
    if (!resetCode) {
      return res.status(404).json({ msg: "Invalid or expired reset link" });
    }

    if (resetCode.expiresAt < new Date()) {
      return res.status(400).json({ msg: "Link has expired" });
    }

    return res.status(200).json({ msg: "Valid reset code", userId });
  } catch (err) {
    console.error("Error in checkPasswordResetDetails:", err.message);
    return res.status(500).json({ msg: "Internal Server Error" });
  }
};

const forgotPasswordChangePassword = async (req, res) => {
  try {
    const { userId, code, newPassword } = req.body;

    // Validate input
    if (!userId || !code || !newPassword) {
      return res.status(400).json({ msg: "All fields are required" });
    }

    const resetCode = await Code.findOne({ userId, code });
    if (!resetCode) {
      return res.status(404).json({ msg: "Invalid or expired reset link" });
    }

    if (resetCode.expiresAt < new Date()) {
      return res.status(400).json({ msg: "Link has expired" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await User.updateOne({ _id: userId }, { password: hashedPassword });

    await Code.deleteOne({ _id: resetCode._id });

    return res.status(200).json({ msg: "Password changed successfully" });
  } catch (err) {
    console.error("Error in forgotPasswordChangePassword:", err.message);
    return res.status(500).json({ msg: "Internal Server Error" });
  }
};

module.exports = {
  redirectGoogle,
  googleCallback,
  verifyUser,
  logout,
  register,
  login,
  verifyEmail,
  codeForForgotPassword,
  changePassword,
  requestPasswordReset,
  checkPasswordResetDetails,
  forgotPasswordChangePassword,
};
