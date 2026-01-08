// controllers/productController.js
const Product = require("../models/Product");
const Auction = require("../models/Auction");

module.exports.addProduct = async (req, res) => {
  try {
    const farmerId = req.user._id; // from authMiddleware

    const {
      name,
      description,
      category,
      quantity,
      unit,
      basePrice,
      images,
      auctionStart,
      auctionEnd,
    } = req.body;

    if (!auctionStart || !auctionEnd) {
      return res.status(400).json({ message: "Auction timings required" });
    }

    // 1️⃣ Create Product
    const product = await Product.create({
      name,
      description,
      category,
      quantity,
      unit,
      basePrice,
      images,
      farmerId,
    });

    // 2️⃣ Create Linked Auction
    const auction = await Auction.create({
      productId: product._id,
      farmerId,
      title: `Auction for ${name}`,
      basePrice,
      startTime: new Date(auctionStart),
      endTime: new Date(auctionEnd),
      started: false,
      currentHighest: basePrice,
      status: "scheduled",
    });

    // 3️⃣ Emit socket event to all buyers
    req.io.emit("newAuction", {
      id: auction._id,
      title: auction.title,
      basePrice: auction.basePrice,
      product: product,
      startTime: auction.startTime,
      endTime: auction.endTime,
      currentHighest: auction.currentHighest,
      started: auction.started,
      status: auction.status,
    });

    res.status(201).json({
      message: "Product + Auction created successfully",
      product,
      auction,
    });
  } catch (error) {
    console.error("ADD PRODUCT ERROR:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
