const Invoice = require('../models/Invoice');
const InvoiceItem = require('../models/InvoiceItem');
const Purchase = require('../models/Purchase');
const InventoryTransaction = require('../models/InventoryTransaction');
const ProductInventory = require('../models/ProductInventory');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Supplier = require('../models/Supplier');
const Expense = require('../models/Expense');
const Salary = require('../models/Salary');
const Employee = require('../models/Employee');
const XLSX = require('xlsx');

class ReportService {
  generateExcelBuffer(data, sheetName = 'Report') {
    const wb = XLSX.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  async getSalesReport({ startDate, endDate, plantId }) {
    const query = {};
    if (startDate || endDate) {
      query.invoiceDate = {};
      if (startDate) query.invoiceDate.$gte = new Date(startDate);
      if (endDate) query.invoiceDate.$lte = new Date(endDate);
    }

    const invoices = await Invoice.find(query)
      .populate('customer')
      .populate('sourcePlantId')
      .populate({
        path: 'products',
        populate: [
          { path: 'productId' },
          { path: 'dispatches.plantId' }
        ]
      })
      .sort({ invoiceDate: -1 });

    const rows = [];

    for (const inv of invoices) {
      for (const item of inv.products || []) {
        for (const disp of item.dispatches || []) {
          const dispPlantId = disp.plantId?._id ? String(disp.plantId._id) : String(disp.plantId);
          if (plantId && dispPlantId !== String(plantId)) {
            continue;
          }

          const sub = disp.quantity * item.rate;
          const gst = Math.round(sub * 0.18 * 100) / 100;

          rows.push({
            'Invoice Date': inv.invoiceDate.toLocaleDateString(),
            'Invoice Number': inv.invoiceNumber,
            'Customer Name': inv.customer?.customerName || 'N/A',
            'Product Name': item.productId?.productName || 'N/A',
            'Product Code': item.productId?.productCode || 'N/A',
            'Dispatch Plant': disp.plantId?.plantName || 'N/A',
            'Quantity Dispatched': disp.quantity,
            'Rate (INR)': item.rate,
            'Subtotal (INR)': sub,
            'GST (18%)': gst,
            'Grand Total (INR)': sub + gst
          });
        }
      }
    }

    return rows;
  }

  async getPurchaseReport({ startDate, endDate, plantId }) {
    const query = {};
    if (startDate || endDate) {
      query.purchaseDate = {};
      if (startDate) query.purchaseDate.$gte = new Date(startDate);
      if (endDate) query.purchaseDate.$lte = new Date(endDate);
    }

    const purchases = await Purchase.find(query)
      .populate('supplierId')
      .populate({
        path: 'items.productId'
      })
      .populate({
        path: 'items.allocations.plantId'
      })
      .sort({ purchaseDate: -1 });

    const rows = [];

    for (const p of purchases) {
      for (const item of p.items || []) {
        for (const alloc of item.allocations || []) {
          const allocPlantId = alloc.plantId?._id ? String(alloc.plantId._id) : String(alloc.plantId);
          if (plantId && allocPlantId !== String(plantId)) {
            continue;
          }

          const total = alloc.quantity * item.purchasePrice;

          rows.push({
            'Purchase Date': p.purchaseDate.toLocaleDateString(),
            'Invoice Number': p.invoiceNumber,
            'Supplier': p.supplierId?.supplierName || 'N/A',
            'Product Name': item.productId?.productName || 'N/A',
            'Product Code': item.productId?.productCode || 'N/A',
            'Allocation Plant': alloc.plantId?.plantName || 'N/A',
            'Quantity Allocated': alloc.quantity,
            'Rate (INR)': item.purchasePrice,
            'Total Outflow (INR)': total
          });
        }
      }
    }

    return rows;
  }

  async getInventoryReport({ plantId }) {
    const query = {};
    if (plantId) query.plantId = plantId;

    const stock = await ProductInventory.find(query)
      .populate('productId')
      .populate('plantId')
      .sort({ productId: 1 });

    return stock.map(s => ({
      'Plant Code': s.plantId?.plantCode || 'N/A',
      'Plant Name': s.plantId?.plantName || 'N/A',
      'Product Code': s.productId?.productCode || 'N/A',
      'Product Name': s.productId?.productName || 'N/A',
      'Category': s.productId?.category || 'N/A',
      'Total Stock': s.quantity,
      'Reserved Stock': s.reservedQuantity,
      'Available Stock': s.availableQuantity,
      'Unit': s.productId?.unit || 'Nos',
      'Unit Purchase Price': s.productId?.purchasePrice || 0,
      'Estimated Value (INR)': s.availableQuantity * (s.productId?.purchasePrice || 0)
    }));
  }

  async getStockMovementReport({ startDate, endDate, plantId }) {
    const query = {};
    if (plantId) query.plantId = plantId;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const txs = await InventoryTransaction.find(query)
      .populate('productId')
      .populate('plantId')
      .populate('createdBy', 'name')
      .sort({ date: -1 });

    return txs.map(t => ({
      'Date': t.date.toLocaleDateString(),
      'Transaction Type': t.transactionType,
      'Product Code': t.productId?.productCode || 'N/A',
      'Product Name': t.productId?.productName || 'N/A',
      'Plant Code': t.plantId?.plantCode || 'N/A',
      'Plant Name': t.plantId?.plantName || 'N/A',
      'Quantity': t.quantity,
      'Rate (INR)': t.rate,
      'Total Value (INR)': t.quantity * t.rate,
      'Reference Type': t.referenceType,
      'Remarks': t.remarks || '',
      'Logged By': t.createdBy?.name || 'N/A'
    }));
  }

  async getLowStockReport({ plantId }) {
    const products = await Product.find();
    const stockQuery = {};
    if (plantId) stockQuery.plantId = plantId;
    const inventory = await ProductInventory.find(stockQuery).populate('plantId');

    const lowStockList = [];

    for (const prod of products) {
      const prodInv = inventory.filter(inv => String(inv.productId) === String(prod._id));
      const totalAvailable = prodInv.reduce((sum, item) => sum + item.availableQuantity, 0);

      if (totalAvailable <= prod.minimumStock) {
        lowStockList.push({
          'Product Code': prod.productCode,
          'Product Name': prod.productName,
          'Category': prod.category,
          'Minimum Limit': prod.minimumStock,
          'Company-Wide Available': totalAvailable,
          'Status': totalAvailable === 0 ? 'Out of Stock' : 'Low Stock',
          'Unit': prod.unit
        });
      }
    }

    return lowStockList;
  }

  async getExpenseReport({ startDate, endDate, category }) {
    const query = {};
    if (category) query.category = category;
    if (startDate || endDate) {
      query.expenseDate = {};
      if (startDate) query.expenseDate.$gte = new Date(startDate);
      if (endDate) query.expenseDate.$lte = new Date(endDate);
    }

    const expenses = await Expense.find(query).sort({ expenseDate: -1 });

    return expenses.map(e => ({
      'Expense Date': e.expenseDate.toLocaleDateString(),
      'Category': e.category,
      'Amount (INR)': e.amount,
      'Remarks': e.remarks || ''
    }));
  }

  async getSalaryReport({ month }) {
    const query = {};
    if (month) query.month = month;

    const salaries = await Salary.find(query).populate('employeeId').sort({ createdAt: -1 });

    return salaries.map(s => ({
      'Month': s.month,
      'Employee Code': s.employeeId?.employeeCode || 'N/A',
      'Employee Name': s.employeeId?.employeeName || 'N/A',
      'Days Present': s.presentDays,
      'Salary Amount (INR)': s.salaryAmount,
      'Payment Status': s.paymentStatus,
      'Payout Date': s.paymentDate ? s.paymentDate.toLocaleDateString() : 'N/A'
    }));
  }

  async getCustomerLedgerReport(customerId) {
    const customer = await Customer.findById(customerId);
    if (!customer) throw new Error('Customer not found');

    const invoices = await Invoice.find({ customer: customerId })
      .populate({
        path: 'products',
        populate: [
          { path: 'productId' },
          { path: 'dispatches.plantId' }
        ]
      })
      .sort({ invoiceDate: 1 });

    return invoices.map(inv => {
      // Find what plants dispatches matched this customer
      const plantsList = [];
      inv.products.forEach(item => {
        item.dispatches.forEach(d => {
          if (d.plantId && !plantsList.includes(d.plantId.plantName)) {
            plantsList.push(d.plantId.plantName);
          }
        });
      });

      return {
        'Invoice Date': inv.invoiceDate.toLocaleDateString(),
        'Invoice Number': inv.invoiceNumber,
        'Source Plants': plantsList.join(', ') || 'N/A',
        'Subtotal': inv.subtotal,
        'GST (18%)': inv.gstAmount,
        'Grand Total': inv.grandTotal,
        'Status': 'Paid'
      };
    });
  }

  async getSupplierLedgerReport(supplierId) {
    const supplier = await Supplier.findById(supplierId);
    if (!supplier) throw new Error('Supplier not found');

    const purchases = await Purchase.find({ supplierId })
      .populate({ path: 'items.productId' })
      .populate({ path: 'items.allocations.plantId' })
      .sort({ purchaseDate: 1 });

    const rows = [];
    for (const p of purchases) {
      for (const item of p.items) {
        for (const alloc of item.allocations) {
          rows.push({
            'Date': p.purchaseDate.toLocaleDateString(),
            'Invoice Number': p.invoiceNumber,
            'Product': item.productId?.productName || 'N/A',
            'Plant Received': alloc.plantId?.plantName || 'N/A',
            'Qty': alloc.quantity,
            'Rate': item.purchasePrice,
            'Amount': alloc.quantity * item.purchasePrice
          });
        }
      }
    }

    return rows;
  }
}

module.exports = new ReportService();
