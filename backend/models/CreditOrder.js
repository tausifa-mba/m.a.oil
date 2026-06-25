const mongoose = require('mongoose');

const CreditOrderItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true, min: 1 },
  rate: { type: Number, required: true, min: 0 },
  amount: { type: Number, required: true, min: 0 },
  dispatches: [{
    plantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plant', required: true },
    quantity: { type: Number, required: true, min: 1 }
  }]
});

const CreditOrderSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true },
  orderDate: { type: Date, required: true, default: Date.now },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  dispatchType: { type: String, enum: ['Single', 'Multi'], default: 'Single' },
  sourcePlantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plant' },
  products: [CreditOrderItemSchema],
  subtotal: { type: Number, required: true, default: 0 },
  grandTotal: { type: Number, required: true, default: 0 },
  referenceNumber: { type: String, default: '' },
  buyerOrderNumber: { type: String, default: '' },
  dispatchNumber: { type: String, default: '' },
  vehicleNumber: { type: String, default: '' },
  dispatchThrough: { type: String, default: '' },
  destination: { type: String, default: '' },
  termsOfDelivery: { type: String, default: '' },
  notes: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, {
  timestamps: true
});

module.exports = mongoose.model('CreditOrder', CreditOrderSchema);
