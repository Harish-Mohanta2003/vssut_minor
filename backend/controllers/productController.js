const products = require("../models/Product");
const auctions = require("../models/Auction");
const { users } = require("../models/User");

// Add product and create auction (robust base64 images)
exports.addProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      quantity,
      unit,
      basePrice,
      category,
      images,
      auctionStart,
      auctionEnd,
    } = req.body;
    const userId = req.user.id;

    // Validate farmer
    const user = users.find((u) => u.id === userId);
    if (!user || user.role !== "farmer") {
      return res.status(403).json({ message: "Only farmers can add products" });
    }

    // Validate auction times
    if (!auctionStart || !auctionEnd) {
      return res.status(400).json({ message: "Auction start and end time required" });
    }
    if (new Date(auctionEnd) <= new Date(auctionStart)) {
      return res.status(400).json({ message: "Auction end must be after start" });
    }

    // Validate and limit images (max 5, must be base64 image strings)
    const imagesArray = Array.isArray(images) ? images.slice(0, 5) : [];
    if (
      imagesArray.some(
        (img) => typeof img !== "string" || !img.startsWith("data:image")
      )
    ) {
      return res.status(400).json({
        message: "Images must be base64 encoded strings of type image.",
      });
    }

    // Generate unique IDs
    const productId = `P${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const auctionId = `A${Date.now()}_${Math.floor(Math.random() * 100000)}`;

    // Create product and auction objects
    const newProduct = {
      productId,
      farmerId: userId,
      name,
      description,
      quantity,
      unit,
      basePrice,
      category,
      images: imagesArray,
      status: "available",
      createdAt: new Date().toISOString(),
    };
    products.push(newProduct);

    const newAuction = {
      auctionId,
      productId: newProduct.productId,
      farmerId: userId,
      startTime: auctionStart,
      endTime: auctionEnd,
      basePrice,
      status: "scheduled",
      bids: [],
      createdAt: new Date().toISOString(),
    };
    auctions.push(newAuction);

    res.status(201).json({
      message: "Product and auction created successfully",
      product: newProduct,
      auction: newAuction,
    });
  } catch (error) {
    console.error("Add product error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Other handlers untouched:
exports.getMyProducts = async (req, res) => {
  try {
    const userId = req.user.id;
    const myProducts = products.filter((p) => p.farmerId === userId);
    res.json({ products: myProducts });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};



exports.getAllProducts = async (req, res) => {
  try {
    res.json({ products });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};


exports.updateProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const updates = req.body;
    const userId = req.user.id;
    const productIndex = products.findIndex((p) => p.productId === productId);
    if (productIndex === -1) {
      return res.status(404).json({ message: "Product not found" });
    }
    if (products[productIndex].farmerId !== userId) {
      return res.status(403).json({ message: "Unauthorized" });
    }
    products[productIndex] = { ...products[productIndex], ...updates };
    res.json({ message: "Product updated", product: products[productIndex] });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};
exports.deleteProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user.id;
    const productIndex = products.findIndex((p) => p.productId === productId);
    if (productIndex === -1) {
      return res.status(404).json({ message: "Product not found" });
    }
    if (products[productIndex].farmerId !== userId) {
      return res.status(403).json({ message: "Unauthorized" });
    }
    products.splice(productIndex, 1);
    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};
