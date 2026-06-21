require('dotenv').config({ override: true });
const mongoose = require('mongoose');
const User = require('./models/User');
const Plant = require('./models/Plant');
const Product = require('./models/Product');
const ProductInventory = require('./models/ProductInventory');
const Customer = require('./models/Customer');
const Supplier = require('./models/Supplier');
const Invoice = require('./models/Invoice');
const InvoiceItem = require('./models/InvoiceItem');
const Purchase = require('./models/Purchase');
const InventoryTransaction = require('./models/InventoryTransaction');
const StockTransfer = require('./models/StockTransfer');
const Employee = require('./models/Employee');
const Attendance = require('./models/Attendance');
const Salary = require('./models/Salary');
const Expense = require('./models/Expense');
const CashBook = require('./models/CashBook');
const CompanySettings = require('./models/CompanySettings');

const seedData = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/container_erp';
    console.log(`Connecting to database for seeding: ${mongoUri}`);
    await mongoose.connect(mongoUri);

    // Drop database to start fresh
    console.log('Clearing existing database collections...');
    const collections = Object.keys(mongoose.connection.collections);
    for (const collectionName of collections) {
      await mongoose.connection.collections[collectionName].deleteMany({});
    }
    console.log('Database cleared!');

    // 0. Seed Company Settings
    console.log('Seeding Company Settings...');
    await CompanySettings.create({
      companyName: 'M.A. OIL',
      address: 'Purani Basti Road Jugsalai, Jamshedpur',
      gstin: '20AGLPM2087Q1ZY',
      stateName: 'Jharkhand',
      stateCode: '20',
      declaration: 'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.',
      authorizedSignatory: 'for M.A. Oil'
    });

    // 1. Seed Users
    console.log('Seeding Users...');
    const adminUser = await User.create({
      name: 'Admin Boss',
      email: 'admin@containererp.com',
      phone: '9876543210',
      password: 'Admin@123', // Will be hashed by pre-save hook
      role: 'Admin',
      status: 'Active'
    });

    const managerUser = await User.create({
      name: 'Manager Bob',
      email: 'manager@containererp.com',
      phone: '9876543211',
      password: 'Manager@123',
      role: 'Manager',
      status: 'Active'
    });

    const staffUser = await User.create({
      name: 'Staff Charlie',
      email: 'staff@containererp.com',
      phone: '9876543212',
      password: 'Staff@123',
      role: 'Staff',
      status: 'Active'
    });

    // 2. Seed Plants
    console.log('Seeding Plants...');
    const plants = await Plant.create([
      {
        plantCode: 'PL001',
        plantName: 'Main Factory',
        address: 'Plot 101, Industrial Area Phase 1, Kolkata',
        managerName: 'Arun Sharma',
        phone: '9123456781',
        status: 'Active'
      },
      {
        plantCode: 'PL002',
        plantName: 'Warehouse A',
        address: 'Sector 5, Salt Lake, Kolkata',
        managerName: 'Subhasish Sen',
        phone: '9123456782',
        status: 'Active'
      },
      {
        plantCode: 'PL003',
        plantName: 'Warehouse B',
        address: 'Dankuni Industrial Zone, Hooghly',
        managerName: 'Pradeep Ghose',
        phone: '9123456783',
        status: 'Active'
      },
      {
        plantCode: 'PL004',
        plantName: 'Yard Storage',
        address: 'Haldia Port Outer Ring Road, Haldia',
        managerName: 'Bijay Roy',
        phone: '9123456784',
        status: 'Active'
      }
    ]);

    // 3. Seed Products
    console.log('Seeding Products...');
    const products = await Product.create([
      {
        productCode: 'PD-PL-210L',
        productName: 'Plastic Barrel 210L',
        category: 'Plastic Barrels',
        materialType: 'HDPE Plastic',
        capacity: '210L',
        purchasePrice: 1200,
        sellingPrice: 1600,
        barcode: '890100200301',
        minimumStock: 40,
        unit: 'Nos',
        description: 'Heavy duty blue plastic barrel with double mouth closures'
      },
      {
        productCode: 'PD-IR-210L',
        productName: 'Iron Drum 210L',
        category: 'Iron Drums',
        materialType: 'Galvanized Iron',
        capacity: '210L',
        purchasePrice: 1800,
        sellingPrice: 2400,
        barcode: '890100200302',
        minimumStock: 25,
        unit: 'Nos',
        description: 'Standard open-top metal drum with clamp ring'
      },
      {
        productCode: 'PD-WA-500L',
        productName: 'Water Storage Barrel 500L',
        category: 'Water Storage Barrels',
        materialType: 'Triple Layer LLDPE',
        capacity: '500L',
        purchasePrice: 3200,
        sellingPrice: 4000,
        barcode: '890100200303',
        minimumStock: 10,
        unit: 'Nos',
        description: 'Green plastic water storage tank for commercial usage'
      },
      {
        productCode: 'PD-CH-1000L',
        productName: 'Chemical Container 1000L',
        category: 'Chemical Containers',
        materialType: 'Composite IBC',
        capacity: '1000L',
        purchasePrice: 9500,
        sellingPrice: 12500,
        barcode: '890100200304',
        minimumStock: 5,
        unit: 'Nos',
        description: 'Intermediate Bulk Container (IBC) with steel cage framework'
      },
      {
        productCode: 'PD-LU-20L',
        productName: 'Engine Oil Lubricant 20L',
        category: 'Lubricants',
        materialType: 'Mineral Oil Base',
        capacity: '20L',
        purchasePrice: 4200,
        sellingPrice: 5000,
        barcode: '890100200305',
        minimumStock: 15,
        unit: 'Pails',
        description: 'High performance heavy commercial vehicle engine lubricant'
      },
      {
        productCode: 'PD-GR-25KG',
        productName: 'Chassis Grease 25kg',
        category: 'Grease Products',
        materialType: 'Calcium Soap Base',
        capacity: '25kg',
        purchasePrice: 3000,
        sellingPrice: 3800,
        barcode: '890100200306',
        minimumStock: 8,
        unit: 'Buckets',
        description: 'Premium chassis grease bucket for heavy transport gears'
      }
    ]);

    // 4. Seed ProductInventory
    console.log('Seeding ProductInventory stock details...');
    // Create stock levels for all products across all plants
    // We will place some stock in Main Factory, Warehouse A, and trigger low stock in Yard/Warehouse B
    const inventoryRecords = [];
    const stockDistribution = [
      // Product 0: Plastic Barrel 210L (min 40)
      { prodIdx: 0, plantIdx: 0, qty: 100 }, // Main Factory
      { prodIdx: 0, plantIdx: 1, qty: 50 },  // Warehouse A
      { prodIdx: 0, plantIdx: 2, qty: 0 },   // Warehouse B
      { prodIdx: 0, plantIdx: 3, qty: 2 },   // Yard

      // Product 1: Iron Drum 210L (min 25)
      { prodIdx: 1, plantIdx: 0, qty: 80 },
      { prodIdx: 1, plantIdx: 1, qty: 20 },
      { prodIdx: 1, plantIdx: 2, qty: 15 },
      { prodIdx: 1, plantIdx: 3, qty: 0 },

      // Product 2: Water Storage 500L (min 10)
      { prodIdx: 2, plantIdx: 0, qty: 12 },
      { prodIdx: 2, plantIdx: 1, qty: 3 },
      { prodIdx: 2, plantIdx: 2, qty: 2 },
      { prodIdx: 2, plantIdx: 3, qty: 1 },

      // Product 3: Chemical Container 1000L IBC (min 5)
      { prodIdx: 3, plantIdx: 0, qty: 1 }, // Low stock company wide (total = 3, min = 5)
      { prodIdx: 3, plantIdx: 1, qty: 1 },
      { prodIdx: 3, plantIdx: 2, qty: 1 },
      { prodIdx: 3, plantIdx: 3, qty: 0 },

      // Product 4: Lubricant 20L (min 15)
      { prodIdx: 4, plantIdx: 0, qty: 45 },
      { prodIdx: 4, plantIdx: 1, qty: 10 },
      { prodIdx: 4, plantIdx: 2, qty: 0 },
      { prodIdx: 4, plantIdx: 3, qty: 5 },

      // Product 5: Chassis Grease 25kg (min 8)
      { prodIdx: 5, plantIdx: 0, qty: 30 },
      { prodIdx: 5, plantIdx: 1, qty: 0 },
      { prodIdx: 5, plantIdx: 2, qty: 5 },
      { prodIdx: 5, plantIdx: 3, qty: 0 }
    ];

    for (const item of stockDistribution) {
      const rec = await ProductInventory.create({
        productId: products[item.prodIdx]._id,
        plantId: plants[item.plantIdx]._id,
        quantity: item.qty,
        reservedQuantity: 0,
        availableQuantity: item.qty
      });
      inventoryRecords.push(rec);
    }

    // 5. Seed Customers
    console.log('Seeding Customers...');
    const customers = await Customer.create([
      {
        customerName: 'Alfa Logistics Private Limited',
        phone: '9830012345',
        email: 'procurement@alfalogistics.com',
        gstNumber: '19AAACA1122D1ZP',
        address: '56/1, G.T. Road, Liluah',
        city: 'Howrah',
        state: 'West Bengal'
      },
      {
        customerName: 'Beta Chemical Industries',
        phone: '9830054321',
        email: 'purchase@betachemicals.co.in',
        gstNumber: '19AAACB5566E2ZQ',
        address: 'Sector 3, Falta SEZ Area',
        city: 'South 24 Parganas',
        state: 'West Bengal'
      },
      {
        customerName: 'Zenith Oil Traders',
        phone: '9830098765',
        email: 'zenithoil@gmail.com',
        gstNumber: '19AAACC9988F3ZR',
        address: 'NH-6 Crossing, Salap',
        city: 'Howrah',
        state: 'West Bengal'
      }
    ]);

    // 6. Seed Suppliers
    console.log('Seeding Suppliers...');
    const suppliers = await Supplier.create([
      {
        supplierName: 'Apex Drums & Containers Ltd',
        phone: '9870011223',
        email: 'sales@apexdrums.com',
        gstNumber: '27AABCA7788A1ZA',
        address: 'Plot 45, MIDC Taloja, Navi Mumbai, Maharashtra'
      },
      {
        supplierName: 'Premier Polymers & Alloys',
        phone: '9870044556',
        email: 'premierpolymers@vsnl.net',
        gstNumber: '24AAACP4411C1ZX',
        address: 'GIDC Industrial Estate, Ankleshwar, Gujarat'
      }
    ]);

    // 7. Seed Employees
    console.log('Seeding Employees...');
    const employees = await Employee.create([
      {
        employeeCode: 'EMP001',
        employeeName: 'Ramesh Kumar',
        phone: '9880011221',
        address: 'Shyamnagar, 24 Parganas North',
        joiningDate: new Date('2025-01-15'),
        dailyWage: 600,
        monthlySalary: 0,
        status: 'Active'
      },
      {
        employeeCode: 'EMP002',
        employeeName: 'Sunita Das',
        phone: '9880011222',
        address: 'Behala Chowrasta, Kolkata',
        joiningDate: new Date('2025-03-01'),
        dailyWage: 0,
        monthlySalary: 18000,
        status: 'Active'
      },
      {
        employeeCode: 'EMP003',
        employeeName: 'Anil Sengupta',
        phone: '9880011223',
        address: 'Salkia, Howrah',
        joiningDate: new Date('2025-06-01'),
        dailyWage: 0,
        monthlySalary: 28000,
        status: 'Active'
      }
    ]);

    // 8. Seed Attendance for past 10 days
    console.log('Seeding Attendance for the last 10 days...');
    const pastDays = 10;
    const today = new Date();
    
    for (let i = pastDays; i >= 1; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      d.setUTCHours(0,0,0,0);

      // Ramesh present, Sunita present, Anil present (mostly)
      await Attendance.create([
        { employeeId: employees[0]._id, date: d, status: i % 5 === 0 ? 'Half Day' : 'Present' },
        { employeeId: employees[1]._id, date: d, status: i % 7 === 0 ? 'Absent' : 'Present' },
        { employeeId: employees[2]._id, date: d, status: 'Present' }
      ]);
    }

    // 9. Seed Salaries (Simulated previous month)
    console.log('Seeding Salaries for previous month...');
    const prevMonth = '2026-05';
    await Salary.create([
      {
        employeeId: employees[0]._id,
        month: prevMonth,
        presentDays: 24,
        salaryAmount: 24 * 600, // Daily wage Ramesh
        paymentStatus: 'Paid',
        paymentDate: new Date('2026-06-05')
      },
      {
        employeeId: employees[1]._id,
        month: prevMonth,
        presentDays: 28,
        salaryAmount: 18000, // Monthly salary Sunita
        paymentStatus: 'Paid',
        paymentDate: new Date('2026-06-05')
      },
      {
        employeeId: employees[2]._id,
        month: prevMonth,
        presentDays: 30,
        salaryAmount: 28000, // Monthly salary Anil
        paymentStatus: 'Pending'
      }
    ]);

    // 10. Seed Expenses
    console.log('Seeding Expenses...');
    const expenses = await Expense.create([
      {
        expenseDate: new Date(today.getTime() - 24 * 60 * 60 * 1000 * 3), // 3 days ago
        category: 'Diesel',
        amount: 3500,
        remarks: 'Diesel filled for transport truck WB-23-4567'
      },
      {
        expenseDate: new Date(today.getTime() - 24 * 60 * 60 * 1000 * 2), // 2 days ago
        category: 'Labour',
        amount: 1500,
        remarks: 'Loading/unloading daily loaders payment'
      },
      {
        expenseDate: new Date(today.getTime() - 24 * 60 * 60 * 1000 * 1), // 1 day ago
        category: 'Electricity',
        amount: 8200,
        remarks: 'Electricity bill payment for PL001 Factory'
      }
    ]);

    // 11. Seed Stock Transfer
    console.log('Seeding Stock Transfer logs...');
    // Transfer 10 plastic barrels from Factory (PL001) to Warehouse A (PL002)
    const transferDate = new Date(today.getTime() - 24 * 60 * 60 * 1000 * 1);
    const transfer = await StockTransfer.create({
      fromPlantId: plants[0]._id,
      toPlantId: plants[1]._id,
      productId: products[0]._id,
      quantity: 10,
      transferDate,
      remarks: 'Internal replenishment request from Warehouse A'
    });

    // Record transactions for transfer
    await InventoryTransaction.create([
      {
        transactionType: 'TRANSFER_OUT',
        productId: products[0]._id,
        plantId: plants[0]._id,
        quantity: 10,
        rate: products[0].purchasePrice,
        referenceType: 'StockTransfer',
        referenceId: transfer._id,
        remarks: `Transferred out to ${plants[1].plantName}`,
        createdBy: adminUser._id,
        date: transferDate
      },
      {
        transactionType: 'TRANSFER_IN',
        productId: products[0]._id,
        plantId: plants[1]._id,
        quantity: 10,
        rate: products[0].purchasePrice,
        referenceType: 'StockTransfer',
        referenceId: transfer._id,
        remarks: `Transferred in from ${plants[0].plantName}`,
        createdBy: adminUser._id,
        date: transferDate
      }
    ]);

    // Adjust stock records manually since we just seeded transfer logs
    const mfBarrel = await ProductInventory.findOne({ productId: products[0]._id, plantId: plants[0]._id });
    mfBarrel.quantity -= 10;
    await mfBarrel.save();

    const waBarrel = await ProductInventory.findOne({ productId: products[0]._id, plantId: plants[1]._id });
    waBarrel.quantity += 10;
    await waBarrel.save();

    // 11.5 Seed Purchase Documents
    console.log('Seeding Purchase Documents (bifurcated)...');
    const purchaseDate = new Date(today.getTime() - 24 * 60 * 60 * 1000 * 3);
    const purchase1 = await Purchase.create({
      supplierId: suppliers[0]._id,
      invoiceNumber: 'PUR-2026-000001',
      purchaseDate,
      createdBy: adminUser._id,
      items: [
        {
          productId: products[0]._id,
          quantity: 220,
          purchasePrice: 1200,
          allocations: [
            { plantId: plants[0]._id, quantity: 100 },
            { plantId: plants[1]._id, quantity: 120 }
          ]
        }
      ]
    });

    // Write PURCHASE transactions for this seed
    await InventoryTransaction.create([
      {
        transactionType: 'PURCHASE',
        productId: products[0]._id,
        plantId: plants[0]._id,
        quantity: 100,
        rate: 1200,
        referenceType: 'PurchaseEntry',
        referenceId: purchase1._id,
        remarks: `Purchase invoice: PUR-2026-000001 (Allocated to plant)`,
        createdBy: adminUser._id,
        date: purchaseDate
      },
      {
        transactionType: 'PURCHASE',
        productId: products[0]._id,
        plantId: plants[1]._id,
        quantity: 120,
        rate: 1200,
        referenceType: 'PurchaseEntry',
        referenceId: purchase1._id,
        remarks: `Purchase invoice: PUR-2026-000001 (Allocated to plant)`,
        createdBy: adminUser._id,
        date: purchaseDate
      }
    ]);

    // Update ProductInventory for Purchase
    const mfBarrelStock = await ProductInventory.findOne({ productId: products[0]._id, plantId: plants[0]._id });
    mfBarrelStock.quantity += 100;
    await mfBarrelStock.save();

    const waBarrelStock = await ProductInventory.findOne({ productId: products[0]._id, plantId: plants[1]._id });
    waBarrelStock.quantity += 120;
    await waBarrelStock.save();

    // 12. Seed Sales Invoices
    console.log('Seeding Sales Invoices...');
    const invoiceDate1 = new Date(today.getTime() - 24 * 60 * 60 * 1000 * 2);
    // Invoice 1: Alfa Logistics purchases 5 Plastic Barrels from PL001
    const [inv1] = await Invoice.create([{
      invoiceNumber: 'INV-2026-000001',
      invoiceDate: invoiceDate1,
      customer: customers[0]._id,
      dispatchType: 'Single',
      sourcePlantId: plants[0]._id,
      subtotal: 5 * 1600,
      gstAmount: Math.round(5 * 1600 * 0.18),
      grandTotal: 5 * 1600 + Math.round(5 * 1600 * 0.18),
      products: []
    }]);

    const [item1] = await InvoiceItem.create([{
      invoiceId: inv1._id,
      productId: products[0]._id,
      quantity: 5,
      rate: 1600,
      amount: 8000,
      dispatches: [
        { plantId: plants[0]._id, quantity: 5 }
      ]
    }]);

    inv1.products.push(item1._id);
    await inv1.save();

    // Deduct stock
    const mfBarrelInv = await ProductInventory.findOne({ productId: products[0]._id, plantId: plants[0]._id });
    mfBarrelInv.quantity -= 5;
    await mfBarrelInv.save();

    // Create SALE transaction
    await InventoryTransaction.create({
      transactionType: 'SALE',
      productId: products[0]._id,
      plantId: plants[0]._id,
      quantity: 5,
      rate: 1600,
      referenceType: 'Invoice',
      referenceId: inv1._id,
      remarks: 'Invoice sales entry: INV-2026-000001',
      createdBy: adminUser._id,
      date: invoiceDate1
    });

    // 13. Seed CashBook History for past 5 days
    console.log('Seeding CashBook daily summaries...');
    // We compute daily cash flow balances manually to set up a realistic history
    // Today-5: Opening 50000, income 0, expenses 0 -> Closing 50000
    // Today-4: Opening 50000, income 0, expenses 0 -> Closing 50000
    // Today-3: Opening 50000, income 0, expenses 3500 (Diesel) -> Closing 46500
    // Today-2: Opening 46500, income 9440 (Sales INV-001 = 8000+1440), expenses 1500 (Labour) -> Closing 54440
    // Today-1: Opening 54440, income 0, expenses 8200 (Electricity) -> Closing 46240
    const dayTimes = [5, 4, 3, 2, 1];
    const cashFlowHistory = [
      { dayAgo: 5, open: 50000, inc: 0, exp: 0 },
      { dayAgo: 4, open: 50000, inc: 0, exp: 0 },
      { dayAgo: 3, open: 50000, inc: 0, exp: 3500 }, // diesel expense
      { dayAgo: 2, open: 46500, inc: 9440, exp: 1500 }, // sale + labour
      { dayAgo: 1, open: 54440, inc: 0, exp: 8200 } // electricity
    ];

    for (const flow of cashFlowHistory) {
      const d = new Date(today);
      d.setDate(today.getDate() - flow.dayAgo);
      d.setUTCHours(0,0,0,0);

      await CashBook.create({
        date: d,
        openingBalance: flow.open,
        income: flow.inc,
        expenses: flow.exp,
        closingBalance: flow.open + flow.inc - flow.exp
      });
    }

    // Set today's CashBook opening balance
    const todayDate = new Date(today);
    todayDate.setUTCHours(0,0,0,0);
    await CashBook.create({
      date: todayDate,
      openingBalance: 46240,
      income: 0,
      expenses: 0,
      closingBalance: 46240
    });

    console.log('Seeding Database Completed Successfully!');
    process.exit(0);

  } catch (err) {
    console.error(`Database seeding failed: ${err.message}`);
    process.exit(1);
  }
};

seedData();
