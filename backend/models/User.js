// backend/models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  phone: { type: String },
  role: { type: String, enum: ["buyer", "farmer"], default: "buyer" },
  address: { type: String },
  farmLocation: { type: String },
  farmerId: { type: String, default: null },
  buyerId: { type: String, default: null },
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
