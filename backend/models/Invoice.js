const mongoose = require('mongoose');

const InvoiceSchema = new mongoose.Schema({
  invoiceNumber: { type: String, required: true, unique: true, trim: true },
  invoiceDate: { type: Date, required: true, default: Date.now },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  sourcePlantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plant', required: false },
  dispatchType: { type: String, enum: ['Single', 'Multi'], default: 'Single' },
  products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'InvoiceItem' }],
  referenceNumber: { type: String, default: '', trim: true },
  buyerOrderNumber: { type: String, default: '', trim: true },
  dispatchNumber: { type: String, default: '', trim: true },
  vehicleNumber: { type: String, default: '', trim: true },
  dispatchThrough: { type: String, default: '', trim: true },
  destination: { type: String, default: '', trim: true },
  termsOfDelivery: { type: String, default: '', trim: true },
  subtotal: { type: Number, required: true, default: 0, min: 0 },
  gstAmount: { type: Number, required: true, default: 0, min: 0 },
  grandTotal: { type: Number, required: true, default: 0, min: 0 }
}, {
  timestamps: true
});

module.exports = mongoose.model('Invoice', InvoiceSchema);
