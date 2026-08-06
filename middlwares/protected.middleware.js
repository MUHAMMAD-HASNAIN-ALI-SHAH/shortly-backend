const pool = require("../config/database");
const jwt = require("jsonwebtoken");

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

    const getUser = await pool.query("SELECT * FROM users WHERE id = $1", [decoded.userId]);
    if (!getUser.rows[0]) {
      return res.status(403).json({ message: "Unauthorized access" });
    }
    
    req.user = getUser.rows[0];
    return next();
  } catch (error) {
    console.error("Protected route error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = protectedRoute;
