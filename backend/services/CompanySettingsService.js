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
    } else {
      let changed = false;
      if (settings.companyName !== 'M.A. OIL') { settings.companyName = 'M.A. OIL'; changed = true; }
      if (settings.address !== 'Purani Basti Road Jugsalai, Jamshedpur') { settings.address = 'Purani Basti Road Jugsalai, Jamshedpur'; changed = true; }
      if (settings.gstin !== '20AGLPM2087Q1ZY') { settings.gstin = '20AGLPM2087Q1ZY'; changed = true; }
      if (settings.stateName !== 'Jharkhand') { settings.stateName = 'Jharkhand'; changed = true; }
      if (settings.stateCode !== '20') { settings.stateCode = '20'; changed = true; }
      if (changed) {
        await settings.save();
      }
    }
    return settings;
  }
}

module.exports = new CompanySettingsService();
