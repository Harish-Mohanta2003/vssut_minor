// routes/auctions.js
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const Auction = require("../models/Auction");
const Product = require("../models/Product");

/* ==========================================================
   GET ALL AUCTIONS
========================================================== */
router.get("/", async (req, res) => {
  try {
    const auctions = await Auction.find()
      .populate("productId")
      .sort({ createdAt: -1 });

    return res.json(auctions);
  } catch (err) {
    console.error("AUCTION FETCH ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/* ==========================================================
   GET LIVE AUCTIONS
========================================================== */
router.get("/live", async (req, res) => {
  try {
    const now = new Date();

    const liveAuctions = await Auction.find({
      status: "active",
      endTime: { $gt: now },
    }).populate("productId");

    return res.json(liveAuctions);
  } catch (err) {
    console.error("LIVE AUCTIONS ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/* ==========================================================
   GET AUCTION BY ID (USED BY AUCTION ROOM)
========================================================== */
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid auction id" });
  }

  try {
    const auction = await Auction.findById(id).populate("productId");

    if (!auction) return res.status(404).json({ message: "Auction not found" });

    return res.json(auction);
  } catch (err) {
    console.error("GET SINGLE AUCTION ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/* ==========================================================
   CREATE NEW AUCTION
========================================================== */
router.post("/", async (req, res) => {
  try {
   io.to(auctionId).emit("bidUpdate", bidPayload); // important for real-time events


    const { productId, title, basePrice, startTime, endTime, farmerId } =
      req.body;

    if (!productId || !title || !basePrice || !startTime || !endTime || !farmerId) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const auction = await Auction.create({
      productId,
      title,
      basePrice,
      currentHighest: basePrice,
      startTime,
      endTime,
      farmerId,
      bids: [],
      started: false,
      status: "scheduled",
    });

    // Notify all buyers/farmers that auction was created
    io?.emit("newAuction", auction);

    /* -------- AUTO START AUCTION ---------- */
    const startDelay = Math.max(new Date(startTime) - Date.now(), 0);
    setTimeout(async () => {
      const a = await Auction.findById(auction._id);
      if (!a || a.status !== "scheduled") return;

      a.status = "active";
      a.started = true;
      await a.save();

      io?.emit("auctionStarted", a);
    }, startDelay);

    /* -------- AUTO END AUCTION ---------- */
    const endDelay = Math.max(new Date(endTime) - Date.now(), 0);
    setTimeout(async () => {
      const a = await Auction.findById(auction._id);
      if (!a || a.status !== "active") return;

      a.status = "ended";
      await a.save();

      io?.emit("auctionEnded", a);
    }, endDelay);

    return res.status(201).json({ message: "Auction created", auction });
  } catch (err) {
    console.error("CREATE AUCTION ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/* ==========================================================
   UPDATE AUCTION (ONLY BEFORE START)
========================================================== */
router.put("/:auctionId", async (req, res) => {
  try {
    const { auctionId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(auctionId)) {
      return res.status(400).json({ message: "Invalid auction id" });
    }

    const auction = await Auction.findById(auctionId);
    if (!auction) return res.status(404).json({ message: "Auction not found" });

    if (auction.started)
      return res.status(400).json({ message: "Cannot update active auction" });

    Object.assign(auction, req.body);
    await auction.save();

    return res.json({ message: "Auction updated", auction });
  } catch (err) {
    console.error("UPDATE AUCTION ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/* ==========================================================
   CANCEL AUCTION (FARMER ONLY)
========================================================== */
router.delete("/:auctionId", async (req, res) => {
  try {
    const { auctionId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(auctionId)) {
      return res.status(400).json({ message: "Invalid auction id" });
    }

    const auction = await Auction.findById(auctionId);
    if (!auction) return res.status(404).json({ message: "Auction not found" });

    if (auction.started)
      return res.status(400).json({ message: "Cannot cancel active auction" });

    auction.status = "canceled";
    await auction.save();

    return res.json({ message: "Auction canceled" });
  } catch (err) {
    console.error("DELETE AUCTION ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
