const mongoose = require('mongoose');

const StockTransferSchema = new mongoose.Schema({
  fromPlantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plant', required: true },
  toPlantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plant', required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true, min: 1 },
  transferDate: { type: Date, required: true, default: Date.now },
  remarks: { type: String, trim: true }
}, {
  timestamps: true
});

module.exports = mongoose.model('StockTransfer', StockTransferSchema);
