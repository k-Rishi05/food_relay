const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: false },
    email: { type: String, required: true, unique: true },
    googleId: { type: String, required: true, unique: true },
    picture: { type: String },
  },
  { timestamps: true },
);

module.exports = mongoose.model("User", userSchema);
