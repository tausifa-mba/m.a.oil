const { supplierRepository } = require('../repositories');
const InventoryTransaction = require('../models/InventoryTransaction');

class SupplierController {
  async createSupplier(req, res) {
    try {
      const supplier = await supplierRepository.create(req.body);
      res.status(201).json({ success: true, supplier });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async listSuppliers(req, res) {
    try {
      const { page, limit, search } = req.query;
      const result = await supplierRepository.findAll({
        search,
        searchFields: ['supplierName', 'phone', 'email', 'address'],
        page,
        limit,
        sortBy: 'supplierName:asc'
      });
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getSupplierById(req, res) {
    try {
      const supplier = await supplierRepository.findById(req.params.id);
      if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found' });
      res.json({ success: true, supplier });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async updateSupplier(req, res) {
    try {
      const supplier = await supplierRepository.update(req.params.id, req.body);
      if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found' });
      res.json({ success: true, supplier });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async deleteSupplier(req, res) {
    try {
      const supplier = await supplierRepository.delete(req.params.id);
      if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found' });
      res.json({ success: true, message: 'Supplier deleted successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getSupplierLedger(req, res) {
    try {
      const { id } = req.params;
      const supplier = await supplierRepository.findById(id);
      if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found' });

      // Find transactions of type PURCHASE referencing supplier name in remarks
      const purchases = await InventoryTransaction.find({
        transactionType: 'PURCHASE',
        remarks: { $regex: supplier.supplierName, $options: 'i' }
      })
      .populate('productId')
      .populate('plantId')
      .sort({ date: -1 });

      const totalPurchased = purchases.reduce((sum, p) => sum + (p.quantity * p.rate), 0);

      res.json({
        success: true,
        supplier,
        purchases,
        totalPurchased
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = new SupplierController();
