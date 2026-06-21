const mongoose = require('mongoose');

const CompanySettingsSchema = new mongoose.Schema({
  companyName: { type: String, required: true, default: 'M.A. OIL', trim: true },
  address: { type: String, required: true, default: 'Purani Basti Road Jugsalai, Jamshedpur', trim: true },
  gstin: { type: String, required: true, default: '20AGLPM2087Q1ZY', uppercase: true, trim: true },
  stateName: { type: String, required: true, default: 'Jharkhand', trim: true },
  stateCode: { type: String, required: true, default: '20', trim: true },
  declaration: { 
    type: String, 
    required: true, 
    default: 'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.',
    trim: true 
  },
  authorizedSignatory: { type: String, required: true, default: 'for M.A. OIL', trim: true }
}, {
  timestamps: true
});

module.exports = mongoose.model('CompanySettings', CompanySettingsSchema);
