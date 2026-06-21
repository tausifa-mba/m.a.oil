const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');
const InvoiceItem = require('../models/InvoiceItem');
const ProductInventory = require('../models/ProductInventory');
const InventoryTransaction = require('../models/InventoryTransaction');
const CashBookService = require('./CashBookService');

class InvoiceService {
  async createInvoice(invoiceData, userId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { customer, dispatchType, sourcePlantId, items, invoiceDate } = invoiceData;
      const isMulti = dispatchType === 'Multi';

      if (!items || items.length === 0) {
        throw new Error('Invoice must contain at least one item');
      }

      if (!isMulti && !sourcePlantId) {
        throw new Error('Source plant is required for single plant dispatch invoices');
      }

      // Generate invoice number
      const dateObj = invoiceDate ? new Date(invoiceDate) : new Date();
      const year = dateObj.getFullYear();
      const regex = new RegExp('^INV-' + year + '-');
      
      const latestInvoice = await Invoice.findOne({ invoiceNumber: regex })
        .sort({ invoiceNumber: -1 })
        .session(session);

      let nextSeqStr = '000001';
      if (latestInvoice) {
        const parts = latestInvoice.invoiceNumber.split('-');
        if (parts.length === 3) {
          const lastSeq = parseInt(parts[2], 10);
          nextSeqStr = String(lastSeq + 1).padStart(6, '0');
        }
      }
      const invoiceNumber = `INV-${year}-${nextSeqStr}`;

      // Calculate totals
      let subtotal = 0;
      for (const item of items) {
        subtotal += item.quantity * item.rate;
      }
      const gstAmount = Math.round(subtotal * 0.18 * 100) / 100;
      const grandTotal = subtotal + gstAmount;

      // Normalize items: make sure dispatches array is populated
      const normalizedItems = items.map(item => {
        let itemDispatches = item.dispatches;
        if (!isMulti) {
          // Force single plant dispatch
          itemDispatches = [{ plantId: sourcePlantId, quantity: item.quantity }];
        }
        return {
          ...item,
          dispatches: itemDispatches
        };
      });

      // 1. Validations
      for (const item of normalizedItems) {
        const { productId, quantity, dispatches } = item;

        const dispatchSum = dispatches.reduce((sum, d) => sum + d.quantity, 0);
        if (dispatchSum !== quantity) {
          throw new Error(`Dispatch sum (${dispatchSum}) must equal ordered quantity (${quantity}) for product ID: ${productId}`);
        }

        for (const dispatch of dispatches) {
          const inventory = await ProductInventory.findOne({ productId, plantId: dispatch.plantId }).session(session);
          if (!inventory || inventory.availableQuantity < dispatch.quantity) {
            throw new Error(`Insufficient stock for product. Available: ${inventory ? inventory.availableQuantity : 0}, Required: ${dispatch.quantity} at plant ID: ${dispatch.plantId}`);
          }
        }
      }

      // 2. Create Invoice Base
      const [invoice] = await Invoice.create([{
        invoiceNumber,
        invoiceDate: dateObj,
        customer,
        dispatchType: dispatchType || 'Single',
        sourcePlantId: isMulti ? undefined : sourcePlantId,
        subtotal,
        gstAmount,
        grandTotal,
        products: []
      }], { session });

      const invoiceItemIds = [];

      // 3. Process items, dispatches, and inventory updates
      for (const item of normalizedItems) {
        const { productId, quantity, rate, dispatches } = item;

        // Create InvoiceItem
        const [invoiceItem] = await InvoiceItem.create([{
          invoiceId: invoice._id,
          productId,
          quantity,
          rate,
          amount: quantity * rate,
          dispatches: dispatches.map(d => ({ plantId: d.plantId, quantity: d.quantity }))
        }], { session });

        invoiceItemIds.push(invoiceItem._id);

        // Deduct inventory and log transactions for each plant dispatch
        for (const dispatch of dispatches) {
          const inventory = await ProductInventory.findOne({ productId, plantId: dispatch.plantId }).session(session);
          inventory.quantity -= dispatch.quantity;
          await inventory.save({ session });

          // Record InventoryTransaction
          await InventoryTransaction.create([{
            transactionType: 'SALE',
            productId,
            plantId: dispatch.plantId,
            quantity: dispatch.quantity,
            rate,
            referenceType: 'Invoice',
            referenceId: invoice._id,
            remarks: `Invoice generated: ${invoiceNumber} (Dispatched)`,
            createdBy: userId,
            date: dateObj
          }], { session });
        }
      }

      // Update Invoice with references
      invoice.products = invoiceItemIds;
      await invoice.save({ session });

      // 4. Record in Cash Book
      await CashBookService.recordTransaction(dateObj, 'INCOME', grandTotal, session);

      await session.commitTransaction();
      session.endSession();

      return await Invoice.findById(invoice._id)
        .populate('customer')
        .populate('sourcePlantId')
        .populate({
          path: 'products',
          populate: [
            { path: 'productId' },
            { path: 'dispatches.plantId' }
          ]
        });

    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }

  async getInvoiceById(id) {
    return await Invoice.findById(id)
      .populate('customer')
      .populate('sourcePlantId')
      .populate({
        path: 'products',
        populate: [
          { path: 'productId' },
          { path: 'dispatches.plantId' }
        ]
      });
  }

  async listInvoices({ page = 1, limit = 10, search = '', sourcePlantId = '', customerId = '', startDate = '', endDate = '' }) {
    const query = {};
    if (customerId) query.customer = customerId;
    
    if (startDate || endDate) {
      query.invoiceDate = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setUTCHours(0,0,0,0);
        query.invoiceDate.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setUTCHours(23,59,59,999);
        query.invoiceDate.$lte = end;
      }
    }

    if (search) {
      query.invoiceNumber = { $regex: search, $options: 'i' };
    }

    if (sourcePlantId) {
      const matchingItems = await InvoiceItem.find({ 'dispatches.plantId': sourcePlantId }).distinct('invoiceId');
      query.$or = [
        { sourcePlantId },
        { _id: { $in: matchingItems } }
      ];
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    const data = await Invoice.find(query)
      .populate('customer')
      .populate('sourcePlantId')
      .populate({
        path: 'products',
        populate: [
          { path: 'productId' },
          { path: 'dispatches.plantId' }
        ]
      })
      .sort({ invoiceDate: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Invoice.countDocuments(query);

    return {
      data,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
    };
  }
}

module.exports = new InvoiceService();
