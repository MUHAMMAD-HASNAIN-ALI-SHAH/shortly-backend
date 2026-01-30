const mongoose = require("mongoose");

const shortUrlSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    index: {
      type: Number,
      unique: true,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    originalUrl: {
      type: String,
      required: true,
    },
    shortUrl: {
      type: String,
      required: true,
    },
    clicks: {
      type: Number,
      default: 0,
    },
    isPasswordProtected: {
      type: Boolean,
      default: false,
    },
    password: {
      type: String,
    },
  },
  { timestamps: true }
);

const ShortUrl = mongoose.model("Short-Url", shortUrlSchema);

module.exports = ShortUrl;
