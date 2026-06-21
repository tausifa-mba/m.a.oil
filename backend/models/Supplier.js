const mongoose = require('mongoose');

const SupplierSchema = new mongoose.Schema({
  supplierName: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  email: { type: String, trim: true, lowercase: true },
  gstNumber: { type: String, trim: true, uppercase: true },
  address: { type: String, required: true, trim: true }
}, {
  timestamps: true
});

module.exports = mongoose.model('Supplier', SupplierSchema);
