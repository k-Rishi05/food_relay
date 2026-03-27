require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const crypto = require("crypto");

const User = require("./models/User");
const Order = require("./models/Order");

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// R2 (S3) Client Setup
const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

// Create a dummy user if none exists (for hackathon purposes to easily get a user ID)
app.post("/api/users", async (req, res) => {
  try {
    const user = new User(req.body);
    await user.save();
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// --- API Routes for Orders ---

// POST /api/orders: Create a new order
app.post("/api/orders", async (req, res) => {
  try {
    const { requester_id, type, location_url, item_description, image_url } =
      req.body;

    // In a real app we'd validate the requester_id exists.
    const order = new Order({
      requester_id,
      type,
      location_url,
      item_description,
      image_url,
      // status defaults to 'pending'
    });

    await order.save();
    res.status(201).json(order);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /api/orders/pending: Fetch orders for the map
app.get("/api/orders/pending", async (req, res) => {
  try {
    const orders = await Order.find({ status: "pending" }).populate(
      "requester_id",
      "name phone",
    );
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/orders/:id/accept: Update status and assign fulfiller
app.patch("/api/orders/:id/accept", async (req, res) => {
  try {
    const { id } = req.params;
    const { fulfiller_id } = req.body; // The user who is accepting the order

    if (!fulfiller_id) {
      return res.status(400).json({ error: "fulfiller_id is required" });
    }

    const order = await Order.findByIdAndUpdate(
      id,
      { status: "accepted", fulfiller_id },
      { new: true },
    );

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json(order);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// --- R2 Storage Route ---

// GET /api/upload-url: Generate a pre-signed S3/R2 URL
app.get("/api/upload-url", async (req, res) => {
  try {
    // We expect the client to send the content type they want to upload, Default to jpeg.
    const contentType = req.query.contentType || "image/jpeg";
    const extension = contentType.split("/")[1] || "img";

    // Generate a unique filename
    const filename = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${extension}`;

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: filename,
      ContentType: contentType,
    });

    // URL expires in 300 seconds (5 minutes)
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

    const publicUrl = `${process.env.R2_PUBLIC_URL}/${filename}`;

    res.json({
      uploadUrl,
      publicUrl,
      filename,
    });
  } catch (error) {
    console.error("Error generating upload URL:", error);
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
