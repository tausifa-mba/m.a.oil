const mongoose = require('mongoose');

const ProductInventorySchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  plantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plant', required: true },
  quantity: { type: Number, required: true, default: 0, min: 0 },
  reservedQuantity: { type: Number, required: true, default: 0, min: 0 },
  availableQuantity: { type: Number, required: true, default: 0, min: 0 }
}, {
  timestamps: true
});

// Ensure a product has exactly one inventory entry per plant
ProductInventorySchema.index({ productId: 1, plantId: 1 }, { unique: true });

// Auto-calculate availableQuantity before saving
ProductInventorySchema.pre('save', function(next) {
  this.availableQuantity = this.quantity - this.reservedQuantity;
  if (this.availableQuantity < 0) {
    this.availableQuantity = 0;
  }
  next();
});

module.exports = mongoose.model('ProductInventory', ProductInventorySchema);
