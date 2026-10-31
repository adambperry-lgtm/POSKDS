/**
 * Bucky's Real Good Pizza (Chatham, NJ)
 * Option 1: Serverless Stripe PaymentIntent Endpoint (POST /api/create-payment-intent)
 *
 * Compatible with Vercel Functions, Netlify Functions, or Express (via server.js).
 * Calculates the order subtotal + NJ 6.625% sales tax on the server and returns a
 * Stripe PaymentIntent client_secret for the embedded <PaymentElement />.
 */
const Stripe = require("stripe");

const NJ_SALES_TAX_RATE = 0.06625;

// Authoritative server-side price lookup table (in USD) for Bucky's menu items
const SERVER_PRICE_BOOK = {
  "spec-round-buffalo": 32.00,
  "spec-detroit-buffalo": 26.00,
  "spec-round-pesto": 32.00,
  "spec-detroit-pesto": 26.00,
  "ny-plain": 24.00,
  "ny-pepperoni": 29.00,
  "ny-hothoney-pep": 32.00,
  "ny-vodka": 26.00,
  "ny-white": 28.00,
  "ny-white-mushroom": 32.00,
  "ny-red-mushroom": 30.00,
  "ny-sausage-onion-chili": 32.00,
  "ny-sausage-rabe": 31.00,
  "ny-longhots": 28.00,
  "ny-margherita": 28.00,
  "ny-tomato-pie": 25.00,
  "det-plain": 20.00,
  "det-pepperoni": 22.00,
  "det-hothoney": 24.00,
  "det-vodka": 22.00,
  "det-cacio": 23.00,
  "det-sausage": 24.00,
  "grandma-pie": 28.00,
  "calzone-family": 26.00,
  "start-meatballs": 14.00,
  "start-knots": 8.00,
  "salad-caesar": 16.00,
  "salad-italian": 19.00,
  "des-cannoli": 5.00,
  "des-olive-oil-cake": 9.00,
  "des-cookie": 4.50,
  "bev-mexican-coke": 4.50,
  "bev-italian-soda": 4.00,
  "bev-spindrift": 3.00
};

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed. Use POST." });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return res.status(503).json({
      error: "STRIPE_SECRET_KEY is not configured on the server."
    });
  }

  try {
    const stripe = new Stripe(secretKey);
    const { cart = [], customerName, customerPhone, customerEmail, promisedTime } = req.body || {};

    if (!Array.isArray(cart) || cart.length === 0) {
      return res.status(400).json({ error: "Cart is empty." });
    }

    // Compute authoritative subtotal on server (supports custom items added in KDS too)
    const subtotal = cart.reduce((sum, item) => {
      const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
      const unitPrice =
        SERVER_PRICE_BOOK[item.id] !== undefined
          ? SERVER_PRICE_BOOK[item.id]
          : Math.max(0, parseFloat(item.price) || 0);
      return sum + unitPrice * qty;
    }, 0);

    const tax = subtotal * NJ_SALES_TAX_RATE;
    const totalUsd = subtotal + tax;
    const amountInCents = Math.max(50, Math.round(totalUsd * 100)); // Stripe minimum is $0.50

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: "usd",
      automatic_payment_methods: { enabled: true }, // Enables Card, Apple Pay, Google Pay, Link
      receipt_email: customerEmail || undefined,
      description: `Bucky's Pizza Chatham NJ — Pickup for ${customerName || "Guest"} (${promisedTime || "ASAP"})`,
      metadata: {
        restaurant: "Buckys Real Good Pizza - 465 Main St Chatham NJ",
        customerName: customerName || "Online Guest",
        customerPhone: customerPhone || "",
        promisedTime: promisedTime || "ASAP",
        itemsSummary: cart.map(i => `${i.quantity}x ${i.name}`).join(", ").slice(0, 490)
      }
    });

    return res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amountInCents
    });
  } catch (err) {
    console.error("Stripe PaymentIntent error:", err);
    return res.status(500).json({
      error: err.message || "Failed to create Stripe PaymentIntent."
    });
  }
};
