const {
  plantRepository,
  productRepository,
  productInventoryRepository,
  inventoryTransactionRepository
} = require('../repositories');
const PurchaseService = require('../services/PurchaseService');
const StockTransferService = require('../services/StockTransferService');
const ProductInventory = require('../models/ProductInventory');
const InventoryTransaction = require('../models/InventoryTransaction');

class InventoryController {
  // PLANTS CRUD
  async createPlant(req, res) {
    try {
      const plant = await plantRepository.create(req.body);
      res.status(201).json({ success: true, plant });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async listPlants(req, res) {
    try {
      const { page, limit, search, status } = req.query;
      const filter = {};
      if (status) filter.status = status;

      const result = await plantRepository.findAll({
        filter,
        search,
        searchFields: ['plantCode', 'plantName', 'managerName'],
        page,
        limit,
        sortBy: 'plantCode:asc'
      });
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getPlantById(req, res) {
    try {
      const plant = await plantRepository.findById(req.params.id);
      if (!plant) return res.status(404).json({ success: false, message: 'Plant not found' });
      res.json({ success: true, plant });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async updatePlant(req, res) {
    try {
      const plant = await plantRepository.update(req.params.id, req.body);
      if (!plant) return res.status(404).json({ success: false, message: 'Plant not found' });
      res.json({ success: true, plant });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async deletePlant(req, res) {
    try {
      const plant = await plantRepository.delete(req.params.id);
      if (!plant) return res.status(404).json({ success: false, message: 'Plant not found' });
      res.json({ success: true, message: 'Plant deleted successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // PRODUCTS CRUD
  async createProduct(req, res) {
    try {
      const product = await productRepository.create(req.body);
      // Automatically create an empty ProductInventory record for all active plants
      const activePlants = await plantRepository.model.find({ status: 'Active' });
      for (const plant of activePlants) {
        await ProductInventory.create({
          productId: product._id,
          plantId: plant._id,
          quantity: 0,
          reservedQuantity: 0,
          availableQuantity: 0
        });
      }

      res.status(201).json({ success: true, product });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async listProducts(req, res) {
    try {
      const { page, limit, search, category } = req.query;
      const filter = {};
      if (category) filter.category = category;

      const result = await productRepository.findAll({
        filter,
        search,
        searchFields: ['productCode', 'productName', 'category', 'description'],
        page,
        limit,
        sortBy: 'productCode:asc'
      });
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getProductById(req, res) {
    try {
      const product = await productRepository.findById(req.params.id);
      if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
      res.json({ success: true, product });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async updateProduct(req, res) {
    try {
      const product = await productRepository.update(req.params.id, req.body);
      if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
      res.json({ success: true, product });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async deleteProduct(req, res) {
    try {
      const product = await productRepository.delete(req.params.id);
      if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
      // Delete corresponding product inventory records
      await ProductInventory.deleteMany({ productId: req.params.id });
      res.json({ success: true, message: 'Product deleted successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // PRODUCT INVENTORY LEVEL
  async getProductInventory(req, res) {
    try {
      const stock = await ProductInventory.find({ productId: req.params.productId }).populate('plantId');
      res.json({ success: true, stock });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getPlantInventorySummary(req, res) {
    try {
      const { plantId } = req.params;
      const stock = await ProductInventory.find({ plantId }).populate('productId');
      res.json({ success: true, stock });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async manualStockAdjustment(req, res) {
    try {
      const { productId, plantId, newQuantity, remarks } = req.body;
      let inventory = await ProductInventory.findOne({ productId, plantId });
      if (!inventory) {
        inventory = new ProductInventory({ productId, plantId, quantity: 0, reservedQuantity: 0 });
      }

      const diff = newQuantity - inventory.quantity;
      if (diff === 0) {
        return res.json({ success: true, message: 'No adjustment needed (quantity same)', inventory });
      }

      inventory.quantity = newQuantity;
      await inventory.save();

      // Log transaction
      await InventoryTransaction.create({
        transactionType: 'ADJUSTMENT',
        productId,
        plantId,
        quantity: Math.abs(diff),
        rate: 0,
        referenceType: 'ManualAdjustment',
        referenceId: inventory._id,
        remarks: `Manual Stock Adjustment. Diff: ${diff > 0 ? '+' : ''}${diff}. ${remarks || ''}`,
        createdBy: req.user._id
      });

      res.json({ success: true, message: 'Inventory adjusted successfully', inventory });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  // PURCHASES (STOCK IN)
  async recordPurchase(req, res) {
    try {
      const tx = await PurchaseService.recordPurchase(req.body, req.user._id);
      res.status(201).json({ success: true, transaction: tx });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async listPurchases(req, res) {
    try {
      const result = await PurchaseService.getPurchaseHistory(req.query);
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // TRANSFERS
  async executeTransfer(req, res) {
    try {
      const transfer = await StockTransferService.executeTransfer(req.body, req.user._id);
      res.status(201).json({ success: true, transfer });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async listTransfers(req, res) {
    try {
      const result = await StockTransferService.listTransfers(req.query);
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = new InventoryController();
