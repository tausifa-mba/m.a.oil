const mongoose = require('mongoose');

const CustomerSchema = new mongoose.Schema({
  customerName: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  email: { type: String, trim: true, lowercase: true },
  gstNumber: { type: String, trim: true, uppercase: true }, // Optional or required for business GST invoicing
  address: { type: String, required: true, trim: true },
  city: { type: String, required: true, trim: true },
  state: { type: String, required: true, trim: true }
}, {
  timestamps: true
});

module.exports = mongoose.model('Customer', CustomerSchema);
