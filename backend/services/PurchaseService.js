const mongoose = require('mongoose');
const Purchase = require('../models/Purchase');
const ProductInventory = require('../models/ProductInventory');
const InventoryTransaction = require('../models/InventoryTransaction');
const CashBookService = require('./CashBookService');
const Supplier = require('../models/Supplier');
const Product = require('../models/Product');

class PurchaseService {
  async recordPurchase(purchaseData, userId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { supplierId, invoiceNumber, purchaseDate, items } = purchaseData;
      const dateObj = purchaseDate ? new Date(purchaseDate) : new Date();

      const supplier = await Supplier.findById(supplierId).session(session);
      if (!supplier) throw new Error('Supplier not found');

      // 1. Validations
      for (const item of items) {
        const product = await Product.findById(item.productId).session(session);
        if (!product) throw new Error('Product not found');

        const allocationTotal = item.allocations.reduce((sum, alloc) => sum + alloc.quantity, 0);
        if (allocationTotal !== item.quantity) {
          throw new Error(`Allocations sum (${allocationTotal}) must equal purchased quantity (${item.quantity}) for product: ${product.productName}`);
        }
      }

      // 2. Process items and allocations
      let totalCost = 0;
      const purchaseItems = [];

      for (const item of items) {
        const { productId, quantity, purchasePrice, allocations } = item;
        totalCost += quantity * purchasePrice;

        const processedAllocations = [];
        for (const alloc of allocations) {
          const { plantId, quantity: allocQty } = alloc;

          // Update ProductInventory for this plant
          let inventory = await ProductInventory.findOne({ productId, plantId }).session(session);
          if (!inventory) {
            [inventory] = await ProductInventory.create([{
              productId,
              plantId,
              quantity: 0,
              reservedQuantity: 0,
              availableQuantity: 0
            }], { session });
          }

          inventory.quantity += parseInt(allocQty, 10);
          await inventory.save({ session });

          // Record InventoryTransaction for this plant
          const [tx] = await InventoryTransaction.create([{
            transactionType: 'PURCHASE',
            productId,
            plantId,
            quantity: allocQty,
            rate: purchasePrice,
            referenceType: 'PurchaseEntry',
            referenceId: new mongoose.Types.ObjectId(), // updated post parent creation
            remarks: `Purchase invoice: ${invoiceNumber} (Allocated to plant)`,
            createdBy: userId,
            date: dateObj
          }], { session });

          processedAllocations.push({
            plantId,
            quantity: allocQty,
            transactionId: tx._id
          });
        }

        purchaseItems.push({
          productId,
          quantity,
          purchasePrice,
          allocations: processedAllocations
        });
      }

      // 3. Create parent Purchase document
      const [purchase] = await Purchase.create([{
        supplierId,
        invoiceNumber,
        purchaseDate: dateObj,
        items: purchaseItems,
        createdBy: userId
      }], { session });

      // Update the InventoryTransactions referenceId to the purchase document ID
      for (const item of purchase.items) {
        for (const alloc of item.allocations) {
          if (alloc.transactionId) {
            await InventoryTransaction.findByIdAndUpdate(
              alloc.transactionId,
              { referenceId: purchase._id },
              { session }
            );
          }
        }
      }

      // 4. Log Cash Book Expense
      await CashBookService.recordTransaction(dateObj, 'EXPENSE', totalCost, session);

      await session.commitTransaction();
      session.endSession();

      return await Purchase.findById(purchase._id)
        .populate('supplierId')
        .populate('createdBy', 'name email')
        .populate('items.productId')
        .populate('items.allocations.plantId');

    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }

  async getPurchaseHistory({ page = 1, limit = 10, plantId = '', productId = '', startDate = '', endDate = '', supplierId = '' }) {
    const query = {};
    if (supplierId) query.supplierId = supplierId;

    if (startDate || endDate) {
      query.purchaseDate = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setUTCHours(0,0,0,0);
        query.purchaseDate.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setUTCHours(23,59,59,999);
        query.purchaseDate.$lte = end;
      }
    }

    if (plantId) {
      query['items.allocations.plantId'] = plantId;
    }
    if (productId) {
      query['items.productId'] = productId;
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    const data = await Purchase.find(query)
      .populate('supplierId')
      .populate('createdBy', 'name email')
      .populate('items.productId')
      .populate('items.allocations.plantId')
      .sort({ purchaseDate: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Purchase.countDocuments(query);

    return {
      data,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
    };
  }
}

module.exports = new PurchaseService();
