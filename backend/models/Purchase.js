const mongoose = require('mongoose');

const PurchaseItemAllocationSchema = new mongoose.Schema({
  plantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plant', required: true },
  quantity: { type: Number, required: true, min: 1 }
});

const PurchaseItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true, min: 1 },
  purchasePrice: { type: Number, required: true, min: 0 },
  allocations: [PurchaseItemAllocationSchema]
});

const PurchaseSchema = new mongoose.Schema({
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
  invoiceNumber: { type: String, required: true, trim: true },
  purchaseDate: { type: Date, required: true, default: Date.now },
  items: [PurchaseItemSchema],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, {
  timestamps: true
});

module.exports = mongoose.model('Purchase', PurchaseSchema);
