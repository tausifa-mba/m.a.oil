const mongoose = require('mongoose');
const StockTransfer = require('../models/StockTransfer');
const ProductInventory = require('../models/ProductInventory');
const InventoryTransaction = require('../models/InventoryTransaction');
const Plant = require('../models/Plant');
const Product = require('../models/Product');

class StockTransferService {
  async executeTransfer(transferData, userId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { fromPlantId, toPlantId, productId, quantity, transferDate, remarks } = transferData;
      const dateObj = transferDate ? new Date(transferDate) : new Date();

      if (String(fromPlantId) === String(toPlantId)) {
        throw new Error('Source and destination plants must be different');
      }

      const qtyNum = parseInt(quantity, 10);
      if (isNaN(qtyNum) || qtyNum <= 0) {
        throw new Error('Transfer quantity must be a positive number');
      }

      // Fetch plants to use their names in remarks
      const fromPlant = await Plant.findById(fromPlantId).session(session);
      const toPlant = await Plant.findById(toPlantId).session(session);
      if (!fromPlant || !toPlant) throw new Error('Source or Destination plant not found');

      const product = await Product.findById(productId).session(session);
      if (!product) throw new Error('Product not found');

      // 1. Verify and update source plant inventory
      const inventoryFrom = await ProductInventory.findOne({ productId, plantId: fromPlantId }).session(session);
      if (!inventoryFrom || inventoryFrom.availableQuantity < qtyNum) {
        throw new Error(`Insufficient stock at source plant. Available: ${inventoryFrom ? inventoryFrom.availableQuantity : 0}, Requested: ${qtyNum}`);
      }

      // 2. Fetch or create destination plant inventory
      let inventoryTo = await ProductInventory.findOne({ productId, plantId: toPlantId }).session(session);
      if (!inventoryTo) {
        [inventoryTo] = await ProductInventory.create([{
          productId,
          plantId: toPlantId,
          quantity: 0,
          reservedQuantity: 0,
          availableQuantity: 0
        }], { session });
      }

      // 3. Deduct from source and add to destination
      inventoryFrom.quantity -= qtyNum;
      inventoryTo.quantity += qtyNum;

      await inventoryFrom.save({ session });
      await inventoryTo.save({ session });

      // 4. Create StockTransfer record
      const [transfer] = await StockTransfer.create([{
        fromPlantId,
        toPlantId,
        productId,
        quantity: qtyNum,
        transferDate: dateObj,
        remarks
      }], { session });

      // 5. Create TRANSFER_OUT transaction for source plant
      await InventoryTransaction.create([{
        transactionType: 'TRANSFER_OUT',
        productId,
        plantId: fromPlantId,
        quantity: qtyNum,
        rate: product.purchasePrice,
        referenceType: 'StockTransfer',
        referenceId: transfer._id,
        remarks: `Transferred out to ${toPlant.plantName}. ${remarks || ''}`,
        createdBy: userId,
        date: dateObj
      }], { session });

      // 6. Create TRANSFER_IN transaction for destination plant
      await InventoryTransaction.create([{
        transactionType: 'TRANSFER_IN',
        productId,
        plantId: toPlantId,
        quantity: qtyNum,
        rate: product.purchasePrice,
        referenceType: 'StockTransfer',
        referenceId: transfer._id,
        remarks: `Transferred in from ${fromPlant.plantName}. ${remarks || ''}`,
        createdBy: userId,
        date: dateObj
      }], { session });

      await session.commitTransaction();
      session.endSession();

      return await StockTransfer.findById(transfer._id)
        .populate('fromPlantId')
        .populate('toPlantId')
        .populate('productId');

    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }

  async listTransfers({ page = 1, limit = 10, fromPlantId = '', toPlantId = '', productId = '', startDate = '', endDate = '' }) {
    const query = {};
    if (fromPlantId) query.fromPlantId = fromPlantId;
    if (toPlantId) query.toPlantId = toPlantId;
    if (productId) query.productId = productId;

    if (startDate || endDate) {
      query.transferDate = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setUTCHours(0,0,0,0);
        query.transferDate.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setUTCHours(23,59,59,999);
        query.transferDate.$lte = end;
      }
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    const data = await StockTransfer.find(query)
      .populate('fromPlantId')
      .populate('toPlantId')
      .populate('productId')
      .sort({ transferDate: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await StockTransfer.countDocuments(query);

    return {
      data,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
    };
  }
}

module.exports = new StockTransferService();
