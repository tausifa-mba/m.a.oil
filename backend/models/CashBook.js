const mongoose = require('mongoose');

const CashBookSchema = new mongoose.Schema({
  openingBalance: { type: Number, required: true, default: 0 },
  income: { type: Number, required: true, default: 0 },
  expenses: { type: Number, required: true, default: 0 },
  closingBalance: { type: Number, required: true, default: 0 },
  date: { type: Date, required: true, unique: true }
}, {
  timestamps: true
});

// Normalize date to midnight UTC and compute closing balance
CashBookSchema.pre('save', function(next) {
  if (this.date) {
    const d = new Date(this.date);
    d.setUTCHours(0, 0, 0, 0);
    this.date = d;
  }
  this.closingBalance = this.openingBalance + this.income - this.expenses;
  next();
});

module.exports = mongoose.model('CashBook', CashBookSchema);
