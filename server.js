/**
 * Bucky's Real Good Pizza (Chatham, NJ)
 * Express Server for Static Frontend + Option 1 Stripe PaymentIntent API +
 * Real-Time Cross-Device Sync via Server-Sent Events (/api/stream & /api/sync-state)
 *
 * Usage:
 *   npm install
 *   STRIPE_PUBLISHABLE_KEY=pk_test_... STRIPE_SECRET_KEY=sk_test_... npm start
 */
require("dotenv").config();
const path = require("path");
const express = require("express");
const createPaymentIntentHandler = require("./api/create-payment-intent");

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname)));

// Connected SSE clients for real-time cross-device sync (Phones <-> Counter POS <-> Kitchen KDS)
const sseClients = new Set();
let latestSharedState = null;

// 1. Expose publishable key to the frontend so index.html can auto-configure Stripe.js
app.get("/api/stripe-config", (req, res) => {
  res.json({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || ""
  });
});

// 2. Create Stripe PaymentIntent for Option 1 Embedded <PaymentElement />
app.post("/api/create-payment-intent", (req, res) => {
  return createPaymentIntentHandler(req, res);
});

// 3. Server-Sent Events stream for real-time cross-device sync
app.get("/api/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  // Send latest state immediately upon connection if available
  if (latestSharedState) {
    res.write(`data: ${JSON.stringify(latestSharedState)}\n\n`);
  }

  sseClients.add(res);
  req.on("close", () => {
    sseClients.delete(res);
  });
});

// 4. Broadcast state updates (new orders, 86'd items, oven slot changes) to all connected devices
app.post("/api/sync-state", (req, res) => {
  const payload = req.body;
  if (!payload || typeof payload !== "object") {
    return res.status(400).json({ error: "Invalid state payload" });
  }

  latestSharedState = payload;
  const serialized = `data: ${JSON.stringify(payload)}\n\n`;
  sseClients.forEach(client => {
    try {
      client.write(serialized);
    } catch (e) {
      sseClients.delete(client);
    }
  });

  res.json({ ok: true, connectedClients: sseClients.size });
});

app.listen(PORT, () => {
  console.log(`🍕 Bucky's Pizza POS/KDS + Real-Time Sync + Stripe Server running at http://localhost:${PORT}`);
});
