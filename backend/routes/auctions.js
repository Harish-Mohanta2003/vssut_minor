const express = require('express');
const router = express.Router();

let auctions = require('../models/Auction');   // Your auctions array/object
let products = require('../models/Product');   // Your products array/object

// Get all auctions by farmer
router.get('/my-auctions', (req, res) => {
  const userId = req.user.id; // Ensure auth middleware sets req.user
  const myAuctions = auctions.filter(a => a.farmerId === userId);
  res.json({ auctions: myAuctions });
});

// Update auction (edit time, details)
router.put('/:auctionId', (req, res) => {
  const userId = req.user.id;
  const { auctionId } = req.params;
  const updates = req.body;
  const idx = auctions.findIndex(a => a.auctionId === auctionId && a.farmerId === userId);

  if (idx === -1) return res.status(404).json({ message: "Auction not found or unauthorized" });
  if (auctions[idx].status === 'active') return res.status(400).json({ message: "Cannot edit active auction" });

  auctions[idx] = { ...auctions[idx], ...updates };
  res.json({ message: "Auction updated", auction: auctions[idx] });
});

// Cancel auction
router.delete('/:auctionId', (req, res) => {
  const userId = req.user.id;
  const { auctionId } = req.params;
  const idx = auctions.findIndex(a => a.auctionId === auctionId && a.farmerId === userId);

  if (idx === -1) return res.status(404).json({ message: "Auction not found or unauthorized" });
  if (auctions[idx].status === 'active') return res.status(400).json({ message: "Cannot cancel active auction" });

  auctions[idx].status = 'canceled';
  res.json({ message: "Auction canceled successfully" });
});

// Get live auctions (for buyers, including product details)
router.get('/live', (req, res) => {
  const now = Date.now();
  // Only include auctions that are started and not expired
  const liveAuctions = auctions
    .filter(a => a.started && a.endTime > now)
    .map(a => ({
      ...a,
      product: products.find(p => p.productId === a.productId) || {}
    }));
  res.json({ auctions: liveAuctions });
});

module.exports = router;
