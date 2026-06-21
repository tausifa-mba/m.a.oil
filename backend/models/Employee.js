const mongoose = require('mongoose');

const EmployeeSchema = new mongoose.Schema({
  employeeCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
  employeeName: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  address: { type: String, required: true, trim: true },
  joiningDate: { type: Date, required: true, default: Date.now },
  dailyWage: { type: Number, required: true, default: 0, min: 0 },
  monthlySalary: { type: Number, required: true, default: 0, min: 0 },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' }
}, {
  timestamps: true
});

module.exports = mongoose.model('Employee', EmployeeSchema);
