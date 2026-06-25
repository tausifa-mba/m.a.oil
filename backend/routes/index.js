const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const inventoryController = require('../controllers/inventoryController');
const salesController = require('../controllers/salesController');
const supplierController = require('../controllers/supplierController');
const hrController = require('../controllers/hrController');
const financeController = require('../controllers/financeController');
const reportController = require('../controllers/reportController');

const { protect, authorize } = require('../middlewares/auth');
const { validateRequest, schemas } = require('../middlewares/validation');
const { authLimiter } = require('../middlewares/rateLimiter');

// --- AUTHENTICATION & USERS ---
router.post('/auth/login', authLimiter, validateRequest(schemas.login), authController.login);
router.get('/auth/profile', protect, authController.getProfile);
router.post('/auth/reset-password', protect, authController.resetPassword);

// User CRUD (Admin-only)
router.post('/auth/users', protect, authorize('Admin'), validateRequest(schemas.user), authController.register);
router.get('/auth/users', protect, authorize('Admin'), authController.listUsers);
router.put('/auth/users/:id', protect, authorize('Admin'), validateRequest(schemas.userUpdate), authController.updateUser);
router.delete('/auth/users/:id', protect, authorize('Admin'), authController.deleteUser);


// --- PLANT MANAGEMENT ---
router.post('/plants', protect, authorize('Admin', 'Manager'), validateRequest(schemas.plant), inventoryController.createPlant);
router.get('/plants', protect, inventoryController.listPlants);
router.get('/plants/:id', protect, inventoryController.getPlantById);
router.put('/plants/:id', protect, authorize('Admin', 'Manager'), validateRequest(schemas.plant), inventoryController.updatePlant);
router.delete('/plants/:id', protect, authorize('Admin'), inventoryController.deletePlant);


// --- PRODUCT MANAGEMENT ---
router.post('/products', protect, authorize('Admin', 'Manager'), validateRequest(schemas.product), inventoryController.createProduct);
router.get('/products', protect, inventoryController.listProducts);
router.get('/products/:id', protect, inventoryController.getProductById);
router.put('/products/:id', protect, authorize('Admin', 'Manager'), validateRequest(schemas.product), inventoryController.updateProduct);
router.delete('/products/:id', protect, authorize('Admin'), inventoryController.deleteProduct);

// Product Inventory Specifics
router.get('/products/:productId/inventory', protect, inventoryController.getProductInventory);
router.get('/plants/:plantId/inventory', protect, inventoryController.getPlantInventorySummary);
router.put('/products/inventory/adjust', protect, authorize('Admin', 'Manager'), inventoryController.manualStockAdjustment);


// --- STOCK IN (PURCHASE ENTRY) ---
router.post('/purchases', protect, authorize('Admin', 'Manager'), validateRequest(schemas.purchase), inventoryController.recordPurchase);
router.get('/purchases', protect, inventoryController.listPurchases);


// --- STOCK TRANSFER ---
router.post('/transfers', protect, authorize('Admin', 'Manager'), validateRequest(schemas.stockTransfer), inventoryController.executeTransfer);
router.get('/transfers', protect, inventoryController.listTransfers);


// --- CUSTOMER MANAGEMENT ---
router.post('/customers', protect, validateRequest(schemas.customer), salesController.createCustomer);
router.get('/customers', protect, salesController.listCustomers);
router.get('/customers/:id', protect, salesController.getCustomerById);
router.put('/customers/:id', protect, validateRequest(schemas.customer), salesController.updateCustomer);
router.delete('/customers/:id', protect, authorize('Admin'), salesController.deleteCustomer);
router.get('/customers/:id/ledger', protect, salesController.getCustomerLedger);


// --- SUPPLIER MANAGEMENT ---
router.post('/suppliers', protect, validateRequest(schemas.supplier), supplierController.createSupplier);
router.get('/suppliers', protect, supplierController.listSuppliers);
router.get('/suppliers/:id', protect, supplierController.getSupplierById);
router.put('/suppliers/:id', protect, validateRequest(schemas.supplier), supplierController.updateSupplier);
router.delete('/suppliers/:id', protect, authorize('Admin'), supplierController.deleteSupplier);
router.get('/suppliers/:id/ledger', protect, supplierController.getSupplierLedger);


// --- INVOICE MANAGEMENT ---
router.post('/invoices', protect, validateRequest(schemas.invoice), salesController.createInvoice);
router.get('/invoices', protect, salesController.listInvoices);
router.get('/invoices/:id', protect, salesController.getInvoiceById);
router.get('/invoices/:id/pdf', protect, salesController.getInvoicePDF);


// --- EMPLOYEE MANAGEMENT ---
router.post('/employees', protect, authorize('Admin', 'Manager'), validateRequest(schemas.employee), hrController.createEmployee);
router.get('/employees', protect, hrController.listEmployees);
router.get('/employees/:id', protect, hrController.getEmployeeById);
router.put('/employees/:id', protect, authorize('Admin', 'Manager'), validateRequest(schemas.employee), hrController.updateEmployee);
router.delete('/employees/:id', protect, authorize('Admin'), hrController.deleteEmployee);


// --- ATTENDANCE MANAGEMENT ---
router.post('/attendance/bulk', protect, authorize('Admin', 'Manager'), validateRequest(schemas.attendanceBulk), hrController.bulkMarkAttendance);
router.get('/attendance/report', protect, hrController.getAttendanceReport);


// --- SALARY MANAGEMENT ---
router.post('/salaries/generate', protect, authorize('Admin', 'Manager'), validateRequest(schemas.salaryGenerate), hrController.generateSalary);
router.post('/salaries/:id/pay', protect, authorize('Admin', 'Manager'), hrController.processSalaryPayment);
router.get('/salaries', protect, hrController.listSalaries);


// --- EXPENSE MANAGEMENT ---
router.post('/expenses', protect, validateRequest(schemas.expense), financeController.createExpense);
router.get('/expenses', protect, financeController.listExpenses);
router.put('/expenses/:id', protect, validateRequest(schemas.expense), financeController.updateExpense);
router.delete('/expenses/:id', protect, authorize('Admin'), financeController.deleteExpense);


// --- CASH BOOK ---
router.get('/cashbook', protect, financeController.getDailyCashBook);
router.get('/cashbook/report', protect, financeController.getCashFlowReport);


// --- REPORTS & DASHBOARD ---
router.get('/reports/:type', protect, reportController.getReport);
router.get('/dashboard', protect, reportController.getDashboardData);

// --- COMPANY SETTINGS ---
const CompanySettingsService = require('../services/CompanySettingsService');
router.get('/settings', protect, async (req, res, next) => {
  try {
    const settings = await CompanySettingsService.getSettings();
    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
});
router.put('/settings', protect, authorize('Admin', 'Manager'), async (req, res, next) => {
  try {
    const settings = await CompanySettingsService.updateSettings(req.body);
    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
});

// --- CREDIT ORDERS ---
const creditOrderController = require('../controllers/creditOrderController');
router.post('/credits', protect, validateRequest(schemas.creditOrder), creditOrderController.createCreditOrder);
router.get('/credits', protect, creditOrderController.listCreditOrders);
router.get('/credits/:id', protect, creditOrderController.getCreditOrderById);

module.exports = router;
