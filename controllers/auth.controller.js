const { default: axios } = require("axios");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const { sendCode, getResetPasswordEmail } = require("../config/email");
const pool = require("../config/database");
const jwt = require("jsonwebtoken");

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

    let user = await pool.query("SELECT * FROM users WHERE email = $1", [email]);

    user = user.rows[0];

    if (!user) {
      const insertResult = await pool.query(
        "INSERT INTO users (username, email, email_verified, google_id) VALUES ($1, $2, $3, $4) RETURNING *",
        [name, email, true, googleId]
      );
      await pool.query(
        "INSERT INTO plans (user_id) VALUES ($1)",
        [insertResult.rows[0].id]
      );
    }

    user = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    user = user.rows[0];

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

const logout = (req, res) => {
  try {
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
    if (existingUser && !existingUser.emailVerified) {
      await pool.query("DELETE FROM users WHERE id = $1", [existingUser.id]);
      await pool.query("DELETE FROM codes WHERE user_id = $1", [existingUser.id]);
    }

    if (existingUser && existingUser.emailVerified) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let newUser = await pool.query(
      "INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING *",
      [username, email, hashedPassword]
    );
    newUser = newUser.rows[0];

    const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();

    await pool.query(
      "INSERT INTO codes (user_id, code, email) VALUES ($1, $2, $3)",
      [newUser.id, verificationCode, email]
    );

    await transporter.sendMail({
      from: `"Shortly" <${process.env.SMTP_EMAIL}>`,
      to: email,
      subject: "Your Verification Code",
      html: sendCode(verificationCode),
    });

    return res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    console.error("Register Error:", err.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const verifyEmail = async (req, res) => {
  try {
    let { code, email } = req.body;

    if (!code) {
      return res
        .status(400)
        .json({ message: "Please provide a verification code" });
    }

    let verification = await pool.query(
      "SELECT * FROM codes WHERE code = $1 AND email = $2",
      [code, email]
    );
    verification = verification.rows[0];

    if (!verification) {
      return res
        .status(400)
        .json({ message: "Invalid or expired verification code" });
    }

    console.log("Verification found:", verification);

    const updatedUser = await pool.query("UPDATE users SET email_verified = $1 WHERE id = $2 RETURNING *", [true, verification.user_id]);
    await pool.query("DELETE FROM codes WHERE id = $1", [verification.id]);

    console.log("User updated:", updatedUser.rows[0]);

    let user = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    user = user.rows[0];

    if (user) {
      await pool.query("INSERT INTO plans (user_id) VALUES ($1)", [user.id]);
    }

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

    console.log("User found:", user);

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

module.exports = {
  redirectGoogle,
  googleCallback,
  verifyUser,
  logout,
  register,
  login,
  verifyEmail,
};
