const mongoose = require("mongoose");

const qrCodeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
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
    qrCodeLink: {
      type: String,
    },
  },
  { timestamps: true }
);

const QrCode = mongoose.model("Qr-Code", qrCodeSchema);

module.exports = QrCode;
