const mongoose = require('mongoose');

const AttendanceSchema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  date: { type: Date, required: true },
  status: { type: String, enum: ['Present', 'Absent', 'Half Day'], required: true }
}, {
  timestamps: true
});

// Compound unique index to restrict to one entry per employee per day
AttendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });

// Normalize the date to midnight UTC before saving
AttendanceSchema.pre('save', function(next) {
  if (this.date) {
    const d = new Date(this.date);
    d.setUTCHours(0, 0, 0, 0);
    this.date = d;
  }
  next();
});

module.exports = mongoose.model('Attendance', AttendanceSchema);
