// routes/products.js
const express = require("express");
const router = express.Router();

const Product = require("../models/Product");
const Auction = require("../models/Auction");
const authMiddleware = require("../middlewares/authMiddleware");


// ======================================================
// ADD PRODUCT + CREATE AUCTION
// ======================================================
router.post("/", authMiddleware, async (req, res) => {
  try {
    const {
      name,
      description,
      category,
      quantity,
      unit,
      basePrice,
      images = [],
      auctionStart,
      auctionEnd,
    } = req.body;

    const farmerId = req.user.id;

    if (!name || !category || !quantity || !unit || !basePrice) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    let startTime = auctionStart ? new Date(auctionStart) : new Date();
    let endTime = auctionEnd
      ? new Date(auctionEnd)
      : new Date(Date.now() + 24 * 60 * 60 * 1000);

    if (endTime <= startTime) {
      return res.status(400).json({
        message: "Auction end time must be after start time",
      });
    }

    const safeImages = Array.isArray(images) ? images.slice(0, 5) : [];

    const product = await Product.create({
      farmerId,
      name,
      description,
      category,
      quantity,
      unit,
      basePrice,
      images: safeImages,
      auctionStart: startTime,
      auctionEnd: endTime,
    });

    const auction = await Auction.create({
      productId: product._id,
      farmerId,
      title: `Auction for ${name}`,
      basePrice,
      currentHighest: basePrice,
      startTime,
      endTime,
      started: false,
      status: "scheduled",
      bids: [],
    });

    const io = req.app.get("io");
    io.emit("newAuction", auction);

    setTimeout(async () => {
      const a = await Auction.findById(auction._id);
      if (!a || a.status !== "scheduled") return;
      a.status = "active";
      a.started = true;
      await a.save();
      io.emit("auctionStarted", a);
    }, startTime - Date.now());

    setTimeout(async () => {
      const a = await Auction.findById(auction._id);
      if (!a || a.status !== "active") return;
      a.status = "ended";
      await a.save();
      io.emit("auctionEnded", a);
    }, endTime - Date.now());

    res.status(201).json({
      message: "Product + Auction created successfully",
      product,
      auction,
    });
  } catch (err) {
    console.error("PRODUCT ERROR:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});


// ======================================================
// GET MY PRODUCTS
// ======================================================
router.get("/my-products", authMiddleware, async (req, res) => {
  try {
    const farmerId = req.user.id;
    const products = await Product.find({ farmerId }).sort({ createdAt: -1 });
    res.json({ products });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});


// ======================================================
// GET SINGLE PRODUCT FOR EDIT PAGE
// ======================================================
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product)
      return res.status(404).json({ message: "Product not found" });

    // ⭐ IMPORTANT FIX → wrap inside { product }
    res.json({ product });
  } catch (err) {
    console.log("GET PRODUCT ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});


// ======================================================
// UPDATE PRODUCT
// ======================================================
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const updated = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!updated)
      return res.status(404).json({ message: "Product not found" });

    res.json({
      message: "Product updated successfully",
      product: updated,
    });
  } catch (err) {
    console.log("UPDATE ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});


// ======================================================
// DELETE PRODUCT
// ======================================================
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const deleted = await Product.findByIdAndDelete(req.params.id);

    if (!deleted)
      return res.status(404).json({ message: "Product not found" });

    res.json({ message: "Product deleted successfully" });
  } catch (err) {
    console.log("DELETE ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
