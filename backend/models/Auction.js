// models/Auction.js
const mongoose = require("mongoose");

const AuctionSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },

    farmerId: { type: String, required: true },

    title: { type: String, required: true },

    basePrice: { type: Number, required: true },

    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },

    started: { type: Boolean, default: false },

    currentHighest: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ["scheduled", "active", "ended"],
      default: "scheduled",
    },

    bids: [
      {
        userId: String,
        userName: String,
        amount: Number,
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Auction", AuctionSchema);
