const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");
const authMiddleware = require("../middlewares/authMiddleware");

// Always pass the reference, never call (no parentheses!)
router.post("/", authMiddleware, productController.addProduct);
router.get("/my-products", authMiddleware, productController.getMyProducts);
router.get("/", productController.getAllProducts);
router.put("/:productId", authMiddleware, productController.updateProduct);
router.delete("/:productId", authMiddleware, productController.deleteProduct);

module.exports = router;
