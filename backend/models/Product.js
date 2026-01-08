// models/Product.js
const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema(
  {
    farmerId: {
      type: String, // from logged-in user.id (string)
      required: true,
    },

    name: { type: String, required: true, trim: true },

    description: { type: String, default: "", trim: true },

    category: { type: String, required: true },

    quantity: { type: Number, required: true },

    unit: { type: String, required: true },

    basePrice: { type: Number, required: true },

    images: {
      type: [String], // base64 encoded
      default: [],
    },

    auctionStart: { type: Date },
    auctionEnd: { type: Date },

    status: {
      type: String,
      enum: ["available", "sold", "cancelled"],
      default: "available",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", ProductSchema);
