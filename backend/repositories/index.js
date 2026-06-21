const BaseRepository = require('./BaseRepository');
const User = require('../models/User');
const Plant = require('../models/Plant');
const Product = require('../models/Product');
const ProductInventory = require('../models/ProductInventory');
const Customer = require('../models/Customer');
const Supplier = require('../models/Supplier');
const Invoice = require('../models/Invoice');
const InvoiceItem = require('../models/InvoiceItem');
const InventoryTransaction = require('../models/InventoryTransaction');
const StockTransfer = require('../models/StockTransfer');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const Salary = require('../models/Salary');
const Expense = require('../models/Expense');
const CashBook = require('../models/CashBook');

class UserRepository extends BaseRepository {
  constructor() { super(User); }
}

class PlantRepository extends BaseRepository {
  constructor() { super(Plant); }
}

class ProductRepository extends BaseRepository {
  constructor() { super(Product); }
}

class ProductInventoryRepository extends BaseRepository {
  constructor() { super(ProductInventory); }
  
  async findByProductAndPlant(productId, plantId, session = null) {
    let query = this.model.findOne({ productId, plantId });
    if (session) query = query.session(session);
    return await query.exec();
  }
}

class CustomerRepository extends BaseRepository {
  constructor() { super(Customer); }
}

class SupplierRepository extends BaseRepository {
  constructor() { super(Supplier); }
}

class InvoiceRepository extends BaseRepository {
  constructor() { super(Invoice); }
}

class InvoiceItemRepository extends BaseRepository {
  constructor() { super(InvoiceItem); }
}

class InventoryTransactionRepository extends BaseRepository {
  constructor() { super(InventoryTransaction); }
}

class StockTransferRepository extends BaseRepository {
  constructor() { super(StockTransfer); }
}

class EmployeeRepository extends BaseRepository {
  constructor() { super(Employee); }
}

class AttendanceRepository extends BaseRepository {
  constructor() { super(Attendance); }
}

class SalaryRepository extends BaseRepository {
  constructor() { super(Salary); }
}

class ExpenseRepository extends BaseRepository {
  constructor() { super(Expense); }
}

class CashBookRepository extends BaseRepository {
  constructor() { super(CashBook); }
}

module.exports = {
  userRepository: new UserRepository(),
  plantRepository: new PlantRepository(),
  productRepository: new ProductRepository(),
  productInventoryRepository: new ProductInventoryRepository(),
  customerRepository: new CustomerRepository(),
  supplierRepository: new SupplierRepository(),
  invoiceRepository: new InvoiceRepository(),
  invoiceItemRepository: new InvoiceItemRepository(),
  inventoryTransactionRepository: new InventoryTransactionRepository(),
  stockTransferRepository: new StockTransferRepository(),
  employeeRepository: new EmployeeRepository(),
  attendanceRepository: new AttendanceRepository(),
  salaryRepository: new SalaryRepository(),
  expenseRepository: new ExpenseRepository(),
  cashBookRepository: new CashBookRepository()
};
