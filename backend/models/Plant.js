const mongoose = require('mongoose');

const PlantSchema = new mongoose.Schema({
  plantCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
  plantName: { type: String, required: true, trim: true },
  address: { type: String, required: true, trim: true },
  managerName: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' }
}, {
  timestamps: true
});

module.exports = mongoose.model('Plant', PlantSchema);
