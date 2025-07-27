const mongoose = require("mongoose");

const planSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
    },
    planType:{
      type: String,
      enum: ["free", "premium", "pro"],
      default: "free",
    },
    urls: {
      type: Number,
      default: 10,
    },
    qrCodes: {
      type: Number,
      default: 5,
    },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  },
  { timestamps: true }
);

const Plan = mongoose.model("Plan", planSchema);

module.exports = Plan;
