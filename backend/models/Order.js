const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    requester_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    fulfiller_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    type: {
      type: String,
      enum: ["gate", "restaurant"],
      required: true,
    },
    location_url: {
      type: String,
      required: true,
    },
    item_description: {
      type: String,
      required: true,
    },
    image_url: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "delivered"],
      default: "pending",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Order", orderSchema);
