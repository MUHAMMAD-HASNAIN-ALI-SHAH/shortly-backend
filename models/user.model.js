const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
    },
    username: {
      type: String,
    },
    picture: {
      type: String,
      default:
        "https://res.cloudinary.com/dpb0qryd0/image/upload/v1752848151/download_w9qcwl.png",
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    password: {
      type: String,
    },
    googleId: {
      type: String,
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

module.exports = User;
