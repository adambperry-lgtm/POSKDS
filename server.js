/**
 * Bucky's Real Good Pizza (Chatham, NJ)
 * Express Server for Static Frontend + Option 1 Stripe PaymentIntent API
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

app.use(express.json());
app.use(express.static(path.join(__dirname)));

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

app.listen(PORT, () => {
  console.log(`🍕 Bucky's Pizza POS/KDS + Stripe Server running at http://localhost:${PORT}`);
});
