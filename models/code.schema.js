const mongoose = require("mongoose");

const codeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  code: { type: String, required: true },
  email: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: "10m" },
});

const Code = mongoose.model("Code", codeSchema);

module.exports = Code;
