require('dotenv').config({ override: true });
const mongoose = require('mongoose');
const InvoiceService = require('./services/InvoiceService');
const StockTransferService = require('./services/StockTransferService');
const ProductInventory = require('./models/ProductInventory');
const InventoryTransaction = require('./models/InventoryTransaction');
const Product = require('./models/Product');
const Plant = require('./models/Plant');
const Customer = require('./models/Customer');
const User = require('./models/User');

const testTransactions = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/container_erp';
    console.log(`Connecting to DB: ${mongoUri}`);
    
    // Set buffer timeout options to fail fast
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });

    console.log('--- STARTING TRANSACTION INTEGRITY TEST ---');

    // 1. Fetch dependencies
    const admin = await User.findOne({ role: 'Admin' });
    const client = await Customer.findOne();
    const product = await Product.findOne({ productCode: 'PD-PL-210L' });
    const plant1 = await Plant.findOne({ plantCode: 'PL001' });
    const plant2 = await Plant.findOne({ plantCode: 'PL002' });

    if (!admin || !client || !product || !plant1 || !plant2) {
      console.error('Missing seeded test data. Please run `npm run seed` first.');
      process.exit(1);
    }

    // Capture initial stock level
    const initialStockPL001 = await ProductInventory.findOne({ productId: product._id, plantId: plant1._id });
    const initialStockPL002 = await ProductInventory.findOne({ productId: product._id, plantId: plant2._id });
    
    console.log(`Initial stock levels for ${product.productName}:`);
    console.log(`- PL001 (Factory): ${initialStockPL001.availableQuantity}`);
    console.log(`- PL002 (Warehouse A): ${initialStockPL002.availableQuantity}`);

    // --- TEST CASE 1: SUCCESSFUL STOCK TRANSFER ---
    console.log('\n[TEST 1] Testing Inter-Plant Stock Transfer...');
    const transferQty = 5;
    
    if (initialStockPL001.availableQuantity < transferQty) {
      console.log(`Refilling PL001 stock to run transfer test.`);
      initialStockPL001.quantity += 10;
      await initialStockPL001.save();
    }

    const transfer = await StockTransferService.executeTransfer({
      fromPlantId: plant1._id,
      toPlantId: plant2._id,
      productId: product._id,
      quantity: transferQty,
      remarks: 'Automated validation transfer'
    }, admin._id);

    // Verify stock change
    const afterTransferPL001 = await ProductInventory.findOne({ productId: product._id, plantId: plant1._id });
    const afterTransferPL002 = await ProductInventory.findOne({ productId: product._id, plantId: plant2._id });
    
    console.log(`Stock after transferring ${transferQty} units:`);
    console.log(`- PL001: ${afterTransferPL001.availableQuantity} (Expected: ${initialStockPL001.availableQuantity - transferQty})`);
    console.log(`- PL002: ${afterTransferPL002.availableQuantity} (Expected: ${initialStockPL002.availableQuantity + transferQty})`);

    const transferLogs = await InventoryTransaction.find({ referenceId: transfer._id });
    console.log(`Inventory Transactions logged: ${transferLogs.length} logs (Expected: 2)`);
    
    const isTest1Passed = 
      afterTransferPL001.quantity === initialStockPL001.quantity - transferQty &&
      afterTransferPL002.quantity === initialStockPL002.quantity + transferQty &&
      transferLogs.length === 2;

    if (isTest1Passed) {
      console.log('✓ TEST 1 PASSED.');
    } else {
      console.error('✗ TEST 1 FAILED.');
    }

    // --- TEST CASE 2: INSUFFICIENT STOCK INVOICE ROLLBACK ---
    console.log('\n[TEST 2] Testing Insufficient Stock Invoice Rollback...');
    const excessiveQty = afterTransferPL001.availableQuantity + 1000;
    
    console.log(`Attempting to invoice ${excessiveQty} units from PL001 (Available: ${afterTransferPL001.availableQuantity})...`);
    
    let caughtError = false;
    try {
      await InvoiceService.createInvoice({
        customer: client._id,
        sourcePlantId: plant1._id,
        items: [{
          productId: product._id,
          quantity: excessiveQty,
          rate: product.sellingPrice
        }]
      }, admin._id);
    } catch (error) {
      caughtError = true;
      console.log(`Caught expected error block: "${error.message}"`);
    }

    // Verify stock has not changed at all
    const afterFailedPL001 = await ProductInventory.findOne({ productId: product._id, plantId: plant1._id });
    console.log(`Stock at PL001 after failed transaction: ${afterFailedPL001.availableQuantity} (Expected: ${afterTransferPL001.availableQuantity})`);

    const isTest2Passed = caughtError && afterFailedPL001.quantity === afterTransferPL001.quantity;

    if (isTest2Passed) {
      console.log('✓ TEST 2 PASSED (Transaction rolled back successfully, stock level preserved).');
    } else {
      console.error('✗ TEST 2 FAILED.');
    }

    // --- TEST CASE 3: MULTI-PLANT DISPATCH SALES & STOCK UPDATE ---
    console.log('\n[TEST 3] Testing Multi-Plant Dispatch Sales & Stock Deduction...');
    
    // Set stock levels
    const p1Stock = await ProductInventory.findOne({ productId: product._id, plantId: plant1._id });
    const p2Stock = await ProductInventory.findOne({ productId: product._id, plantId: plant2._id });
    
    const initialP1Qty = p1Stock.availableQuantity;
    const initialP2Qty = p2Stock.availableQuantity;
    
    console.log(`Available stock before multi-plant dispatch:`);
    console.log(`- PL001: ${initialP1Qty}`);
    console.log(`- PL002: ${initialP2Qty}`);
    
    // Ensure we have enough stock to dispatch
    if (initialP1Qty < 10) {
      p1Stock.quantity += 10;
      await p1Stock.save();
    }
    if (initialP2Qty < 5) {
      p2Stock.quantity += 5;
      await p2Stock.save();
    }
    
    const refreshedP1Qty = (await ProductInventory.findOne({ productId: product._id, plantId: plant1._id })).availableQuantity;
    const refreshedP2Qty = (await ProductInventory.findOne({ productId: product._id, plantId: plant2._id })).availableQuantity;
    
    const invoice = await InvoiceService.createInvoice({
      customer: client._id,
      dispatchType: 'Multi',
      items: [{
        productId: product._id,
        quantity: 15,
        rate: product.sellingPrice,
        dispatches: [
          { plantId: plant1._id, quantity: 10 },
          { plantId: plant2._id, quantity: 5 }
        ]
      }]
    }, admin._id);
    
    // Fetch updated stock
    const afterP1Stock = await ProductInventory.findOne({ productId: product._id, plantId: plant1._id });
    const afterP2Stock = await ProductInventory.findOne({ productId: product._id, plantId: plant2._id });
    
    console.log(`Available stock after multi-plant dispatch (10 from PL001, 5 from PL002):`);
    console.log(`- PL001: ${afterP1Stock.availableQuantity} (Expected: ${refreshedP1Qty - 10})`);
    console.log(`- PL002: ${afterP2Stock.availableQuantity} (Expected: ${refreshedP2Qty - 5})`);
    
    const isTest3Passed = 
      afterP1Stock.quantity === refreshedP1Qty - 10 &&
      afterP2Stock.quantity === refreshedP2Qty - 5;
      
    if (isTest3Passed) {
      console.log('✓ TEST 3 PASSED.');
    } else {
      console.error('✗ TEST 3 FAILED.');
    }

    console.log('\n--- TRANSACTION TESTS COMPLETED ---');
    process.exit(isTest1Passed && isTest2Passed && isTest3Passed ? 0 : 1);

  } catch (error) {
    console.error('Error during transaction test execution:', error);
    process.exit(1);
  }
};

testTransactions();
