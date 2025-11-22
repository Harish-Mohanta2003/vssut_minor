require("dotenv").config();
const express = require("express");
const http = require("http");
const socketIO = require("socket.io");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const app = express();
const port = process.env.PORT || 5000;
const server = http.createServer(app);
const io = socketIO(server, {
  cors: { origin: "http://localhost:3000", credentials: true },
});

// --- Middleware ---
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

// --- Models (Array mocks, replace with DB/models in production) ---
let auctions = []; // [{ id, productId, title, bids: [{user, amount}], endTime, startTime, started, basePrice }]
let products = require("./models/Product"); // Your products array/object

// --- REST Routes ---
const authRoutes = require("./routes/auth");
app.use("/api/auth", authRoutes);

const productRoutes = require("./routes/products");
app.use("/api/products", productRoutes);

// --- Auction REST API (require auctions and products arrays for full context) ---
const auctionRoutes = require("./routes/auctions");
app.use("/api/auctions", auctionRoutes);

// --- Root route ---
app.get("/", (req, res) => {
  res.send("AgroBid backend server");
});

// --- Auction Creation REST Route (with real-time emission) ---
app.post("/api/auctions", (req, res) => {
  const {
    productId,
    title,
    basePrice,
    startTime,
    endTime,
    farmerId
    // Add other fields as needed
  } = req.body;

  const newAuction = {
    id: `A${Date.now()}_${Math.floor(Math.random() * 100000)}`,
    productId,
    title,
    basePrice,
    startTime,
    endTime,
    started: false,
    farmerId,
    currentHighest: basePrice,
    bids: [],
  };

  auctions.push(newAuction);

  // Emit new auction in real time to all buyers
  io.emit("newAuction", {
    ...newAuction,
    product: products.find(p => p.productId === productId) || {},
  });

  res.status(201).json({ message: "Auction created", auction: newAuction });
});

// --- Socket.io Real-time Auction ---
io.on("connection", (socket) => {
  console.log("Socket connected");

  socket.on("joinAuction", ({ auctionId, user }) => {
    // Only buyers can join
    if (!user || user.role !== "buyer") return;
    socket.join(auctionId);
    const auction = auctions.find((a) => a.id === auctionId);
    if (auction) {
      socket.emit("auctionData", auction);
    }
  });

  socket.on("placeBid", ({ auctionId, user, bidAmount }) => {
    // Only buyers can bid
    if (!user || user.role !== "buyer") return;
    const auction = auctions.find((a) => a.id === auctionId);
    if (auction && auction.started && Date.now() < auction.endTime) {
      if (bidAmount > (auction.currentHighest || auction.basePrice)) {
        auction.bids.push({ user: user.name, amount: bidAmount });
        auction.currentHighest = bidAmount;
        io.to(auctionId).emit("bidUpdate", {
          user: user.name,
          bidAmount,
          auctionId,
        });
      }
    }
  });

  socket.on("startAuction", ({ auctionId }) => {
    const auction = auctions.find((a) => a.id === auctionId);
    if (auction) {
      auction.started = true;
      io.emit("auctionStatusChanged", {
        auctionId: auction.id,
        started: auction.started,
        startTime: auction.startTime,
        endTime: auction.endTime,
      });
      io.to(auctionId).emit("auctionStarted");
    }
  });

  socket.on("endAuction", ({ auctionId }) => {
    const auction = auctions.find((a) => a.id === auctionId);
    if (auction) {
      auction.started = false;
      io.emit("auctionStatusChanged", {
        auctionId: auction.id,
        started: auction.started,
        startTime: auction.startTime,
        endTime: auction.endTime,
      });
      // Winner logic: highest bid
      const highestBid = auction.bids.reduce(
        (max, b) => (b.amount > max.amount ? b : max),
        { amount: auction.basePrice, user: null }
      );
      io.to(auctionId).emit("auctionEnded", {
        winner: highestBid.user,
        amount: highestBid.amount,
      });
    }
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected");
  });
});

// --- Start Combined REST + Socket.io Server ---
server.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
