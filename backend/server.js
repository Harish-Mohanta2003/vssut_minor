// server.js
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");

// your route imports (adjust paths if needed)
const authRoutes = require("./routes/auth");
const productRoutes = require("./routes/products");
const auctionRoutes = require("./routes/auctions");

const Auction = require("./models/Auction");

const app = express();
const PORT = process.env.PORT || 5000;

/* -----------------------------------------
   MIDDLEWARE
--------------------------------------------*/
app.use(
  cors({
    origin: "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

/* -----------------------------------------
   ROUTES
--------------------------------------------*/
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/auctions", auctionRoutes);

app.get("/", (req, res) => res.send("Backend running"));

/* -----------------------------------------
   CREATE HTTP + SOCKET.IO SERVER
--------------------------------------------*/
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    credentials: true,
  },
});

// make io accessible to routes if needed
app.set("io", io);

/* -----------------------------------------
   We will maintain a map of running timers per auction.
   This avoids multiple intervals for the same auction.
--------------------------------------------*/
const auctionIntervals = new Map();

/* Helper to start emitting time ticks for an auction */
async function startAuctionTicker(auctionId) {
  // don't start twice
  if (auctionIntervals.has(auctionId)) return;

  // emit once immediately
  const emitTime = async () => {
    try {
      const a = await Auction.findById(auctionId);
      if (!a) {
        // stop if auction removed
        clearIntervalHandle();
        return;
      }

      // if auction not active anymore, stop ticker and emit ended
      if (a.status !== "active") {
        io.to(auctionId).emit("auctionEnded", { auctionId, auction: a });
        clearIntervalHandle();
        return;
      }

      const payload = {
        auctionId,
        serverTime: Date.now(),
        endTime: new Date(a.endTime).getTime(),
      };

      io.to(auctionId).emit("time", payload);
    } catch (e) {
      console.error("TICK ERROR:", e);
    }
  };

  // Set up interval and fire immediately
  emitTime();
  const intId = setInterval(emitTime, 1000);

  const clearIntervalHandle = () => {
    clearInterval(intId);
    auctionIntervals.delete(auctionId);
  };

  auctionIntervals.set(auctionId, { intId, clearIntervalHandle });
}

/* If auction becomes active because of scheduled job in routes/auctions,
   those routes already called `io.emit('auctionStarted', a)` — we need to
   also start the ticker when auction becomes active. We can listen to that event
   from this same server's code: when a route emits auctionStarted via io,
   it will be broadcasted — but starting per-auction ticker is easiest inside
   server when an active auction is detected or when a client joins. */

/* -----------------------------------------
   SOCKET EVENTS
--------------------------------------------*/
io.on("connection", (socket) => {
  console.log("🔥 Socket connected:", socket.id);

  /* JOIN AUCTION ROOM */
  socket.on("joinAuction", async (auctionId) => {
    if (!auctionId) return;
    socket.join(auctionId);
    console.log(`📥 ${socket.id} joined auction room ${auctionId}`);

    // send immediate time sync + start ticker if active
    try {
      const auction = await Auction.findById(auctionId);
      if (!auction) {
        // optionally notify client it's invalid
        socket.emit("bidError", { message: "Auction not found" });
        return;
      }

      // time sync payload
      socket.emit("time", {
        auctionId,
        serverTime: Date.now(),
        endTime: new Date(auction.endTime).getTime(),
      });

      // if auction active, start ticker for this auction (if not started)
      if (auction.status === "active") {
        startAuctionTicker(auctionId);
      }
    } catch (err) {
      console.error("JOIN AUCTION ERROR:", err);
    }
  });

  /* LEAVE AUCTION ROOM */
  socket.on("leaveAuction", (auctionId) => {
    socket.leave(auctionId);
    console.log(`📤 ${socket.id} left auction room ${auctionId}`);
  });

  /* -----------------------------------------
     PLACE BID — robust handling
  --------------------------------------------*/
  socket.on("placeBid", async (payload) => {
    try {
      // normalize input
      const {
        auctionId,
        bidderId,
        bidderName,
        amount, // we expect `amount` (number)
      } = payload || {};

      console.log("📥 Received bid:", payload);

      if (!auctionId || !amount) {
        return socket.emit("bidRejected", { message: "Invalid bid data" });
      }

      const auction = await Auction.findById(auctionId);
      if (!auction) {
        return socket.emit("bidRejected", { message: "Auction not found" });
      }

      if (auction.status !== "active") {
        return socket.emit("bidRejected", { message: "Auction is not active" });
      }

      if (amount <= auction.currentHighest) {
        return socket.emit("bidRejected", {
          message: "Bid must be higher",
          currentHighest: auction.currentHighest,
        });
      }

      // persist bid
      auction.currentHighest = amount;
      auction.bids.push({
        bidderId,
        bidderName,
        amount,
        timestamp: new Date(),
      });

      await auction.save();

      // prepare payload to broadcast
      const bidPayload = {
        auctionId,
        amount,
        bidderName,
        bidderId,
        timestamp: new Date().toISOString(),
      };

      console.log("📡 Broadcasting bidUpdate:", bidPayload);
      io.to(auctionId).emit("bidUpdate", bidPayload);

      // ensure ticker is running (so time sync continues)
      startAuctionTicker(auctionId);

    } catch (err) {
      console.error("❌ Bid Error:", err);
      socket.emit("bidError", { message: "Server error placing bid" });
    }
  });

  /* DISCONNECT */
  socket.on("disconnect", () => {
    console.log("⚠️ Socket disconnected:", socket.id);
  });
});

/* -----------------------------------------
   Periodic check for auctions that should be ended (safety)
   This runs every 5 seconds and will mark auctions ended if their endTime passed.
   When ended, it emits auctionEnded and stops the ticker.
--------------------------------------------*/
setInterval(async () => {
  try {
    const now = new Date();
    const toEnd = await Auction.find({
      status: "active",
      endTime: { $lte: now },
    });

    for (const a of toEnd) {
      a.status = "ended";
      await a.save();

      // notify room
      io.to(a._id.toString()).emit("auctionEnded", { auctionId: a._id.toString(), auction: a });

      // stop ticker if running
      const t = auctionIntervals.get(a._id.toString());
      if (t?.clearIntervalHandle) t.clearIntervalHandle();
    }
  } catch (e) {
    console.error("AUTO-END CHECK ERROR:", e);
  }
}, 5000);

/* -----------------------------------------
   START SERVER
--------------------------------------------*/
mongoose
  .connect(process.env.MONGO_URL)
  .then(() => {
    console.log("📦 MongoDB connected");
    server.listen(PORT, () => {
      console.log(`🚀 Server running: http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ DB Error:", err.message);
    process.exit(1);
  });
