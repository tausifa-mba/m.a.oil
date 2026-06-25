const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  productCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
  productName: { type: String, required: true, trim: true },
  category: { type: String, required: true, trim: true }, // e.g. Plastic Drum, Lubricant
  materialType: { type: String, required: true, trim: true }, // e.g. HDPE Plastic, Steel, Iron
  capacity: { type: String, required: true, trim: true }, // e.g. 210L, 20L
  purchasePrice: { type: Number, default: 0, min: 0 },
  sellingPrice: { type: Number, default: 0, min: 0 },
  barcode: { type: String, trim: true },
  hsnCode: { type: String, default: '72042590', trim: true },
  minimumStock: { type: Number, required: true, default: 0, min: 0 },
  unit: { type: String, required: true, default: 'Nos' }, // e.g. Nos, Litres, Kgs
  description: { type: String, trim: true }
}, {
  timestamps: true
});

module.exports = mongoose.model('Product', ProductSchema);
