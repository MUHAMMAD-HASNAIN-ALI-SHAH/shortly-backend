const User = require("../models/user.model");
const mongoose = require("mongoose");

const protectedRoute = async (req, res, next) => {
  try {
    if (!req.session.user) {
      return res.status(403).json({ message: "Unauthorized access" });
    }
    const userId = req.session.user.userId;
    if (!userId || mongoose.Types.ObjectId.isValid(userId) === false) {
      return res.status(403).json({ message: "Unauthorized access" });
    }
    if (req.session.user) {
      const getUser = await User.findById(userId).select("-password");
      if (!getUser) {
        return res.status(403).json({ message: "Unauthorized access" });
      }
      req.user = getUser;
      return next();
    }
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = protectedRoute;
