const mongoose = require('mongoose');

const ExpenseSchema = new mongoose.Schema({
  expenseDate: { type: Date, required: true, default: Date.now },
  category: { 
    type: String, 
    enum: ['Transport', 'Diesel', 'Labour', 'Electricity', 'Rent', 'Miscellaneous'], 
    required: true 
  },
  amount: { type: Number, required: true, min: 0 },
  remarks: { type: String, trim: true }
}, {
  timestamps: true
});

module.exports = mongoose.model('Expense', ExpenseSchema);
