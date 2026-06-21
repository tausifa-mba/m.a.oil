const mongoose = require('mongoose');

const SalarySchema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  month: { type: String, required: true, trim: true }, // Format: YYYY-MM
  presentDays: { type: Number, required: true, default: 0 },
  salaryAmount: { type: Number, required: true, min: 0 },
  paymentStatus: { type: String, enum: ['Paid', 'Pending'], default: 'Pending' },
  paymentDate: { type: Date }
}, {
  timestamps: true
});

// Avoid duplicate salary generation for the same employee in a month
SalarySchema.index({ employeeId: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('Salary', SalarySchema);
