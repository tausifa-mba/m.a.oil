const mongoose = require('mongoose');

const InventoryTransactionSchema = new mongoose.Schema({
  transactionType: { 
    type: String, 
    enum: ['PURCHASE', 'SALE', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT'], 
    required: true 
  },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  plantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plant', required: true },
  quantity: { type: Number, required: true, min: 1 },
  rate: { type: Number, required: true, default: 0 },
  referenceType: { 
    type: String, 
    enum: ['Invoice', 'PurchaseEntry', 'StockTransfer', 'ManualAdjustment'], 
    required: true 
  },
  referenceId: { type: mongoose.Schema.Types.ObjectId, required: true },
  remarks: { type: String, trim: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  date: { type: Date, required: true, default: Date.now }
}, {
  timestamps: true
});

module.exports = mongoose.model('InventoryTransaction', InventoryTransactionSchema);
