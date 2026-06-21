const ReportService = require('../services/ReportService');
const ProductInventory = require('../models/ProductInventory');
const Product = require('../models/Product');
const Plant = require('../models/Plant');
const Invoice = require('../models/Invoice');
const InventoryTransaction = require('../models/InventoryTransaction');
const Customer = require('../models/Customer');

class ReportController {
  // EXCEL DOWNLOAD / JSON REPORT ROUTER
  async getReport(req, res) {
    try {
      const { type } = req.params;
      const { format, startDate, endDate, plantId, month, customerId, supplierId } = req.query;

      let data = [];
      let sheetName = 'Report';

      switch (type) {
        case 'sales':
          data = await ReportService.getSalesReport({ startDate, endDate, plantId });
          sheetName = 'Sales Report';
          break;
        case 'purchases':
          data = await ReportService.getPurchaseReport({ startDate, endDate, plantId });
          sheetName = 'Purchases Report';
          break;
        case 'inventory':
          data = await ReportService.getInventoryReport({ plantId });
          sheetName = 'Inventory Report';
          break;
        case 'stock-movements':
          data = await ReportService.getStockMovementReport({ startDate, endDate, plantId });
          sheetName = 'Stock Movements Report';
          break;
        case 'lowstock':
          data = await ReportService.getLowStockReport({ plantId });
          sheetName = 'Low Stock Report';
          break;
        case 'expenses':
          data = await ReportService.getExpenseReport({ startDate, endDate });
          sheetName = 'Expense Report';
          break;
        case 'salaries':
          data = await ReportService.getSalaryReport({ month });
          sheetName = 'Salary Report';
          break;
        case 'customer-ledger':
          if (!customerId) return res.status(400).json({ success: false, message: 'customerId is required' });
          data = await ReportService.getCustomerLedgerReport(customerId);
          sheetName = 'Customer Ledger';
          break;
        case 'supplier-ledger':
          if (!supplierId) return res.status(400).json({ success: false, message: 'supplierId is required' });
          data = await ReportService.getSupplierLedgerReport(supplierId);
          sheetName = 'Supplier Ledger';
          break;
        default:
          return res.status(400).json({ success: false, message: 'Invalid report type' });
      }

      if (format === 'excel') {
        const buffer = ReportService.generateExcelBuffer(data, sheetName);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${sheetName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.xlsx"`);
        return res.send(buffer);
      }

      res.json({ success: true, count: data.length, data });
    } catch (error) {
      console.error('Report generation error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // ADMIN DASHBOARD SUMMARY
  async getDashboardData(req, res) {
    try {
      const selectedPlantId = req.query.plantId; // Optional filter

      // 1. Total Company Stock & Plant-wise stocks
      const inventories = await ProductInventory.find().populate('productId').populate('plantId');
      
      let filteredInvs = inventories;
      if (selectedPlantId) {
        filteredInvs = inventories.filter(inv => String(inv.plantId?._id) === String(selectedPlantId));
      }

      const totalCompanyStock = filteredInvs.reduce((sum, item) => sum + item.availableQuantity, 0);
      const totalInventoryValue = filteredInvs.reduce((sum, item) => {
        const cost = item.productId?.purchasePrice || 0;
        return sum + (item.availableQuantity * cost);
      }, 0);

      // Low stock count (available stock <= minimumStock)
      const products = await Product.find();
      let lowStockCount = 0;
      for (const prod of products) {
        const prodInvs = filteredInvs.filter(inv => String(inv.productId?._id) === String(prod._id));
        const avail = prodInvs.reduce((sum, item) => sum + item.availableQuantity, 0);
        if (avail <= prod.minimumStock) {
          lowStockCount++;
        }
      }

      // 2. Customers Count
      const totalCustomers = await Customer.countDocuments();

      // 3. Plant-wise Metrics (for dashboard cards)
      const plants = await Plant.find({ status: 'Active' });
      const plantWiseStock = [];
      const plantWiseValue = [];
      const plantWiseLowStock = [];

      for (const pl of plants) {
        const plInvs = inventories.filter(inv => String(inv.plantId?._id) === String(pl._id));
        
        // Stock
        const stockSum = plInvs.reduce((sum, item) => sum + item.availableQuantity, 0);
        plantWiseStock.push({ plantName: pl.plantName, plantCode: pl.plantCode, stock: stockSum });

        // Value
        const valSum = plInvs.reduce((sum, item) => sum + (item.availableQuantity * (item.productId?.purchasePrice || 0)), 0);
        plantWiseValue.push({ plantName: pl.plantName, value: valSum });

        // Low stock count inside this specific plant
        let plLowStock = 0;
        for (const prod of products) {
          const matching = plInvs.find(inv => String(inv.productId?._id) === String(prod._id));
          const qty = matching ? matching.availableQuantity : 0;
          if (qty <= prod.minimumStock) {
            plLowStock++;
          }
        }
        plantWiseLowStock.push({ plantName: pl.plantName, count: plLowStock });
      }

      // 4. Sales and Purchases today / monthly
      const startOfToday = new Date();
      startOfToday.setUTCHours(0, 0, 0, 0);
      const endOfToday = new Date();
      endOfToday.setUTCHours(23, 59, 59, 999);

      let todaySales = 0;
      const currentYear = new Date().getFullYear();
      const monthlySales = Array(12).fill(0);

      const salesQueryYear = {
        invoiceDate: {
          $gte: new Date(`${currentYear}-01-01T00:00:00.000Z`),
          $lte: new Date(`${currentYear}-12-31T23:59:59.999Z`)
        }
      };

      const yearInvoices = await Invoice.find(salesQueryYear).populate({
        path: 'products',
        populate: { path: 'productId' }
      });

      yearInvoices.forEach(inv => {
        const isToday = inv.invoiceDate >= startOfToday && inv.invoiceDate <= endOfToday;
        const m = new Date(inv.invoiceDate).getUTCMonth();

        if (selectedPlantId) {
          let plantSales = 0;
          (inv.products || []).forEach(item => {
            (item.dispatches || []).forEach(disp => {
              const dispPlantId = disp.plantId?._id ? String(disp.plantId._id) : String(disp.plantId);
              if (dispPlantId === String(selectedPlantId)) {
                const sub = disp.quantity * item.rate;
                plantSales += sub * 1.18; // subtotal + 18% GST
              }
            });
          });

          if (isToday) todaySales += plantSales;
          monthlySales[m] += plantSales;
        } else {
          if (isToday) todaySales += inv.grandTotal;
          monthlySales[m] += inv.grandTotal;
        }
      });

      const purchaseQueryToday = { 
        transactionType: 'PURCHASE', 
        date: { $gte: startOfToday, $lte: endOfToday } 
      };
      if (selectedPlantId) purchaseQueryToday.plantId = selectedPlantId;
      const todayPurchaseTx = await InventoryTransaction.find(purchaseQueryToday);
      const todayPurchases = todayPurchaseTx.reduce((sum, p) => sum + (p.quantity * p.rate), 0);

      const pendingPayments = Math.round(todaySales * 0.25); 

      // 5. Monthly Sales chart details (current year)
      const monthlyPurchases = Array(12).fill(0);

      const purchaseQueryYear = {
        transactionType: 'PURCHASE',
        date: {
          $gte: new Date(`${currentYear}-01-01T00:00:00.000Z`),
          $lte: new Date(`${currentYear}-12-31T23:59:59.999Z`)
        }
      };
      if (selectedPlantId) purchaseQueryYear.plantId = selectedPlantId;
      const yearPurchases = await InventoryTransaction.find(purchaseQueryYear);
      yearPurchases.forEach(p => {
        const m = new Date(p.date).getUTCMonth();
        monthlyPurchases[m] += (p.quantity * p.rate);
      });

      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthlySalesChart = months.map((name, i) => ({
        month: name,
        sales: Math.round(monthlySales[i]),
        purchases: Math.round(monthlyPurchases[i])
      }));

      // 6. Category Distribution
      const catCount = {};
      filteredInvs.forEach(inv => {
        const cat = inv.productId?.category || 'Uncategorized';
        catCount[cat] = (catCount[cat] || 0) + itemQuantity(inv);
      });
      const categoryDistribution = Object.keys(catCount).map(key => ({
        type: key,
        value: catCount[key]
      }));

      res.json({
        success: true,
        metrics: {
          totalCompanyStock,
          totalInventoryValue: Math.round(totalInventoryValue),
          lowStockCount,
          totalCustomers,
          todaySales: Math.round(todaySales),
          todayPurchases: Math.round(todayPurchases),
          pendingPayments
        },
        plantWiseStock,
        plantWiseValue,
        plantWiseLowStock,
        monthlySalesChart,
        categoryDistribution
      });

    } catch (error) {
      console.error('Dashboard fetching error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

// Helper to extract inventory quantities safely
function itemQuantity(inv) {
  return inv.availableQuantity || 0;
}

module.exports = new ReportController();
