const mongoose = require('mongoose');
const CreditOrder = require('../models/CreditOrder');
const ProductInventory = require('../models/ProductInventory');
const InventoryTransaction = require('../models/InventoryTransaction');

class CreditOrderService {
  async createCreditOrder(orderData, userId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const {
        customer,
        dispatchType,
        sourcePlantId,
        items,
        orderDate,
        referenceNumber,
        buyerOrderNumber,
        dispatchNumber,
        vehicleNumber,
        dispatchThrough,
        destination,
        termsOfDelivery,
        notes
      } = orderData;
      const isMulti = dispatchType === 'Multi';

      if (!items || items.length === 0) {
        throw new Error('Credit order must contain at least one item');
      }

      if (!isMulti && !sourcePlantId) {
        throw new Error('Source plant is required for single plant dispatch credit orders');
      }

      // Generate credit order number
      const dateObj = orderDate ? new Date(orderDate) : new Date();
      const year = dateObj.getFullYear();
      const regex = new RegExp('^CO-' + year + '-');
      
      const latestOrder = await CreditOrder.findOne({ orderNumber: regex })
        .sort({ orderNumber: -1 })
        .session(session);

      let nextSeqStr = '000001';
      if (latestOrder) {
        const parts = latestOrder.orderNumber.split('-');
        if (parts.length === 3) {
          const lastSeq = parseInt(parts[2], 10);
          nextSeqStr = String(lastSeq + 1).padStart(6, '0');
        }
      }
      const orderNumber = `CO-${year}-${nextSeqStr}`;

      // Calculate totals
      let subtotal = 0;
      const productsList = [];

      for (const item of items) {
        const { productId, quantity, rate, dispatches } = item;
        let itemDispatches = dispatches;
        if (!isMulti) {
          itemDispatches = [{ plantId: sourcePlantId, quantity }];
        }

        const dispatchSum = itemDispatches.reduce((sum, d) => sum + d.quantity, 0);
        if (dispatchSum !== quantity) {
          throw new Error(`Dispatch sum (${dispatchSum}) must equal quantity (${quantity})`);
        }

        // Verify stock
        for (const disp of itemDispatches) {
          const inventory = await ProductInventory.findOne({ productId, plantId: disp.plantId }).session(session);
          if (!inventory || inventory.availableQuantity < disp.quantity) {
            throw new Error(`Insufficient stock for product. Available: ${inventory ? inventory.availableQuantity : 0}, Required: ${disp.quantity} at plant ID: ${disp.plantId}`);
          }
        }

        // Deduct inventory and log transactions
        for (const disp of itemDispatches) {
          const inventory = await ProductInventory.findOne({ productId, plantId: disp.plantId }).session(session);
          inventory.quantity -= disp.quantity;
          await inventory.save({ session });

          // Record Inventory Transaction
          await InventoryTransaction.create([{
            transactionType: 'SALE',
            productId,
            plantId: disp.plantId,
            quantity: disp.quantity,
            rate,
            referenceType: 'CreditOrder',
            remarks: `Credit order generated: ${orderNumber} (Dispatched)`,
            createdBy: userId,
            date: dateObj
          }], { session });
        }

        const amount = quantity * rate;
        subtotal += amount;

        productsList.push({
          productId,
          quantity,
          rate,
          amount,
          dispatches: itemDispatches.map(d => ({ plantId: d.plantId, quantity: d.quantity }))
        });
      }

      // Create the Credit Order
      const [creditOrder] = await CreditOrder.create([{
        orderNumber,
        orderDate: dateObj,
        customer,
        dispatchType: dispatchType || 'Single',
        sourcePlantId: isMulti ? undefined : sourcePlantId,
        referenceNumber: referenceNumber || '',
        buyerOrderNumber: buyerOrderNumber || '',
        dispatchNumber: dispatchNumber || '',
        vehicleNumber: vehicleNumber || '',
        dispatchThrough: dispatchThrough || '',
        destination: destination || '',
        termsOfDelivery: termsOfDelivery || '',
        notes: notes || '',
        products: productsList,
        subtotal,
        grandTotal: subtotal,
        createdBy: userId
      }], { session });

      await session.commitTransaction();
      session.endSession();

      return await CreditOrder.findById(creditOrder._id)
        .populate('customer')
        .populate('sourcePlantId')
        .populate({
          path: 'products.productId'
        })
        .populate({
          path: 'products.dispatches.plantId'
        });

    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }

  async listCreditOrders(query = {}, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const filter = {};
    if (query.search) {
      filter.$or = [
        { orderNumber: new RegExp(query.search, 'i') },
        { referenceNumber: new RegExp(query.search, 'i') }
      ];
    }
    
    const count = await CreditOrder.countDocuments(filter);
    const data = await CreditOrder.find(filter)
      .sort({ orderDate: -1 })
      .skip(skip)
      .limit(limit)
      .populate('customer')
      .populate('sourcePlantId')
      .populate({
        path: 'products.productId'
      });

    return { data, total: count, page, limit };
  }

  async getCreditOrderById(id) {
    return await CreditOrder.findById(id)
      .populate('customer')
      .populate('sourcePlantId')
      .populate({
        path: 'products.productId'
      })
      .populate({
        path: 'products.dispatches.plantId'
      });
  }
}

module.exports = new CreditOrderService();
