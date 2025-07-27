const protectedRoute = (req, res, next) => {
  try {
    if (req.session.user) {
      return next();
    }
    return res.status(401).json({ message: "Unauthorized access" });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = protectedRoute;
