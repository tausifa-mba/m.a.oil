const CompanySettings = require('../models/CompanySettings');

class CompanySettingsService {
  async getSettings() {
    let settings = await CompanySettings.findOne();
    if (!settings) {
      settings = await CompanySettings.create({
        companyName: 'M.A. OIL',
        address: 'Purani Basti Road Jugsalai, Jamshedpur',
        gstin: '20AGLPM2087Q1ZY',
        stateName: 'Jharkhand',
        stateCode: '20',
        declaration: 'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.',
        authorizedSignatory: 'for M.A. Oil'
      });
    }
    return settings;
  }
}

module.exports = new CompanySettingsService();
