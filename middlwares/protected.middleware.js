const pool = require("../config/database");
const jwt = require("jsonwebtoken");
const redis = require("../config/redis");

const protectedRoute = async (req, res, next) => {
  try {
    const token = req.cookies.access_token;

    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded || !decoded.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const redisKey = `user:${decoded.userId}`;

    // 1. Try Redis first
    let user = await redis.get(redisKey);

    if (user) {
      user = typeof user === "string" ? JSON.parse(user) : user;
    } else {
      // 2. Cache miss -> fall back to DB
      const getUser = await pool.query("SELECT * FROM users WHERE id = $1", [decoded.userId]);
      user = getUser.rows[0];

      if (!user) {
        return res.status(403).json({ message: "Unauthorized access" });
      }

      // 3. Re-populate cache so next request hits Redis
      await redis.set(
        redisKey,
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
        { ex: 7 * 24 * 60 * 60 }
      );
    }

    req.user = user;
    return next();
  } catch (error) {
    console.error("Protected route error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = protectedRoute;