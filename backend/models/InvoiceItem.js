const mongoose = require('mongoose');

const InvoiceItemSchema = new mongoose.Schema({
  invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true, min: 1 },
  rate: { type: Number, required: true, min: 0 },
  amount: { type: Number, required: true, min: 0 },
  dispatches: [
    {
      plantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plant', required: true },
      quantity: { type: Number, required: true, min: 1 }
    }
  ]
}, {
  timestamps: true
});

module.exports = mongoose.model('InvoiceItem', InvoiceItemSchema);
