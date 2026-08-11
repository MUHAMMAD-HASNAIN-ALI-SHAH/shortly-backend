const { default: axios } = require("axios");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const { verificationLink, getResetPasswordEmail } = require("../config/email");
const pool = require("../config/database");
const jwt = require("jsonwebtoken");
const redis = require("../config/redis");

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

    const { email, name, googleId } = userRes.data;

    // Always fetch from DB by email (no cache check)
    let dbUser = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    let user = dbUser.rows[0];

    if (!user) {
      const insertResult = await pool.query(
        "INSERT INTO users (username, email, email_verified, google_id) VALUES ($1, $2, $3, $4) RETURNING *",
        [name, email, true, googleId]
      );
      await pool.query(
        "INSERT INTO plans (user_id) VALUES ($1)",
        [insertResult.rows[0].id]
      );

      dbUser = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
      user = dbUser.rows[0];
    }

    // Set in Redis keyed by userId (no get, just set)
    await redis.set(
      `user:${user.id}`,
      JSON.stringify({
        id: user.id,
        username: user.username,
        email: user.email,
        picture: user.picture,
        email_verified: user.email_verified,
        created_at: user.created_at,
        updated_at: user.updated_at,
        google_id: user.google_id,
      }),
      {
        ex: 7 * 24 * 60 * 60, // 7 days in seconds
      }
    );

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        username: user.username,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.cookie("access_token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
  } catch (err) {
    console.error("OAuth Error", err.response?.data || err.message);
    res.status(500).send("Authentication failed");
  }
};

const verifyUser = (req, res) => {
  try {
    const user = req.user;
    if (user) {
      return res.status(200).json({ username: user.username, email: user.email, picture: user.picture });
    }
    return res.status(200).json({ message: "Not authenticated" });
  } catch (error) {
    console.error("Verification Error", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const logout = async (req, res) => {
  try {
    const user = req.user;

    console.log("Logging out user:", user);
    redis.del(`user:${user.id}`);

    res.clearCookie("access_token", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    });
    return res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout Error", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const register = async (req, res) => {
  try {
    let { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: "Please fill in all fields" });
    }

    email = email.trim().toLowerCase();

    let existingUser = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    existingUser = existingUser.rows[0];

    if (existingUser && !existingUser.email_verified) {
      await pool.query("DELETE FROM users WHERE id = $1", [existingUser.id]);
      await pool.query("DELETE FROM codes WHERE user_id = $1", [existingUser.id]);
      // Clean up any stale Redis entry for the deleted unverified user
      await redis.del(`user:${existingUser.id}`);
    }

    if (existingUser && existingUser.email_verified) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let newUser = await pool.query(
      "INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING *",
      [username, email, hashedPassword]
    );
    newUser = newUser.rows[0];

    // Cache the new user in Redis (same trimmed shape as googleCallback)
    await redis.set(
      `user:${newUser.id}`,
      JSON.stringify({
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        picture: newUser.picture,
        email_verified: newUser.email_verified,
        created_at: newUser.created_at,
        updated_at: newUser.updated_at,
        google_id: newUser.google_id,
      }),
      {
        ex: 7 * 24 * 60 * 60, // 7 days in seconds
      }
    );

    const verificationToken = jwt.sign(
      { userId: newUser.id },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    const verification = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

    await transporter.sendMail({
      from: `"Shortly" <${process.env.SMTP_EMAIL}>`,
      to: email,
      subject: "Your Verification Link",
      html: verificationLink(verification),
    });

    return res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    console.error("Register Error:", err.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const verifyEmail = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ message: "Missing token" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded || !decoded.userId) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    const user = await pool.query("SELECT * FROM users WHERE id = $1", [decoded.userId]);
    if (!user.rows[0]) {
      return res.status(404).json({ message: "User not found" });
    }

    await pool.query("UPDATE users SET email_verified = true WHERE id = $1", [decoded.userId]);

    return res.status(201).json({ message: "Email verified successfully" });
  } catch (err) {
    console.error("Email Verification Error:", err.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const login = async (req, res) => {
  try {
    let { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Please fill in all fields" });
    }

    email = email.trim().toLowerCase();

    let user = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    user = user.rows[0];

    if (!user || !user.email_verified) {
      return res
        .status(400)
        .json({ message: "User does not exist or email not verified" });
    }

    if (!user.password) {
      return res.status(400).json({ message: "User signed up with Google" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Refresh Redis cache on successful login
    await redis.set(
      `user:${user.id}`,
      JSON.stringify({
        id: user.id,
        username: user.username,
        email: user.email,
        picture: user.picture,
        email_verified: user.email_verified,
        created_at: user.created_at,
        updated_at: user.updated_at,
        google_id: user.google_id,
      }),
      {
        ex: 7 * 24 * 60 * 60, // 7 days in seconds
      }
    );

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        username: user.username,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.cookie("access_token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({ username: user.username, email: user.email, picture: user.picture });
  } catch (err) {
    console.error("Login Controller Error:", err.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const getRecoveryLink = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Please provide an email" });
    }

    const user = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (!user.rows[0]) {
      return res.status(404).json({ message: "User not found" });
    }

    const resetPasswordToken = jwt.sign(
      { userId: user.rows[0].id },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    const resetPasswordLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetPasswordToken}`;

    await transporter.sendMail({
      from: `"Shortly" <${process.env.SMTP_EMAIL}>`,
      to: email,
      subject: "Reset Your Password",
      html: getResetPasswordEmail(resetPasswordLink),
    });

    return res.status(200).json();
  } catch (err) {
    console.error("Get Recovery Link Error:", err.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ message: "Missing token or new password" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded || !decoded.userId) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    // check jwt expiration
    if (decoded.exp * 1000 < Date.now()) {
      return res.status(400).json({ message: "Token has expired" });
    }

    const user = await pool.query("SELECT * FROM users WHERE id = $1", [decoded.userId]);
    if (!user.rows[0]) {
      return res.status(404).json({ message: "User not found" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await pool.query("UPDATE users SET password = $1 WHERE id = $2", [hashedPassword, decoded.userId]);

    return res.status(200).json({ message: "Password reset successfully" });
  } catch (err) {
    console.error("Reset Password Error:", err.message);
    return res.status(500).json({ message: err.message || "Internal Server Error" });
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
  getRecoveryLink,
  resetPassword,
};
