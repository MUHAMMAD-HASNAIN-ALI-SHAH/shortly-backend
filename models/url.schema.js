const mongoose = require("mongoose");

const urlSchema = new mongoose.Schema(
  {
    index: {
      type: Number,
      unique: true,
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["short-url", "qr-code"],
    },
    title: {
      type: String,
      required: true,
    },
    originalUrl: {
      type: String,
      required: true,
    },
    linkId: {
      type: String,
    },
    shortUrl: {
      type: String,
    },
    qrCodeLink: {
      type: String,
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

const Url = mongoose.model("Url", urlSchema);

module.exports = Url;
