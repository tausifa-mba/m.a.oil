const Joi = require('joi');

const validateRequest = (schema) => {
  return (req, res, next) => {
    const isUpdate = req.method === 'PUT' || req.method === 'PATCH';
    const { error } = schema.validate(req.body, { 
      abortEarly: false, 
      allowUnknown: true,
      context: { isUpdate }
    });
    if (error) {
      const details = error.details.map(d => d.message);
      return res.status(400).json({ success: false, errors: details });
    }
    next();
  };
};

const schemas = {
  login: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please enter a valid email address',
      'any.required': 'Email is required'
    }),
    password: Joi.string().required().messages({
      'any.required': 'Password is required'
    })
  }),

  user: Joi.object({
    name: Joi.string().min(2).max(50).required(),
    email: Joi.string().email().required(),
    phone: Joi.string().required(),
    password: Joi.string().min(6).required(),
    role: Joi.string().valid('Admin', 'Manager', 'Staff').default('Staff'),
    status: Joi.string().valid('Active', 'Inactive').default('Active')
  }),

  userUpdate: Joi.object({
    name: Joi.string().min(2).max(50).required(),
    email: Joi.string().email().required(),
    phone: Joi.string().required(),
    password: Joi.string().min(6).optional(),
    role: Joi.string().valid('Admin', 'Manager', 'Staff').default('Staff'),
    status: Joi.string().valid('Active', 'Inactive').default('Active')
  }),

  plant: Joi.object({
    plantCode: Joi.string().min(2).max(10).required(),
    plantName: Joi.string().min(2).max(100).required(),
    address: Joi.string().required(),
    managerName: Joi.string().required(),
    phone: Joi.string().required(),
    status: Joi.string().valid('Active', 'Inactive').default('Active')
  }),

  product: Joi.object({
    productCode: Joi.string().required(),
    productName: Joi.string().required(),
    category: Joi.string().required(),
    materialType: Joi.string().required(),
    capacity: Joi.string().required(),
    purchasePrice: Joi.number().min(0).required(),
    sellingPrice: Joi.number().min(0).required(),
    barcode: Joi.string().allow('', null),
    hsnCode: Joi.string().allow('', null),
    minimumStock: Joi.number().min(0).default(0),
    unit: Joi.string().default('Nos'),
    description: Joi.string().allow('', null)
  }),

  customer: Joi.object({
    customerName: Joi.string().required(),
    phone: Joi.string().required(),
    email: Joi.string().email().allow('', null),
    gstNumber: Joi.string().allow('', null),
    address: Joi.string().required(),
    city: Joi.string().required(),
    state: Joi.string().required()
  }),

  supplier: Joi.object({
    supplierName: Joi.string().required(),
    phone: Joi.string().required(),
    email: Joi.string().email().allow('', null),
    gstNumber: Joi.string().allow('', null),
    address: Joi.string().required()
  }),

  invoice: Joi.object({
    customer: Joi.string().hex().length(24).required(),
    dispatchType: Joi.string().valid('Single', 'Multi').default('Single'),
    sourcePlantId: Joi.string().hex().length(24).when('dispatchType', {
      is: 'Single',
      then: Joi.required(),
      otherwise: Joi.optional().allow('', null)
    }),
    invoiceDate: Joi.date().optional(),
    referenceNumber: Joi.string().allow('', null),
    buyerOrderNumber: Joi.string().allow('', null),
    dispatchNumber: Joi.string().allow('', null),
    vehicleNumber: Joi.string().allow('', null),
    dispatchThrough: Joi.string().allow('', null),
    destination: Joi.string().allow('', null),
    termsOfDelivery: Joi.string().allow('', null),
    items: Joi.array().items(
      Joi.object({
        productId: Joi.string().hex().length(24).required(),
        quantity: Joi.number().integer().min(1).required(),
        rate: Joi.number().min(0).required(),
        dispatches: Joi.array().items(
          Joi.object({
            plantId: Joi.string().hex().length(24).required(),
            quantity: Joi.number().integer().min(1).required()
          })
        ).min(1).required()
      })
    ).min(1).required()
  }),

  purchase: Joi.object({
    supplierId: Joi.string().hex().length(24).required(),
    invoiceNumber: Joi.string().required(),
    purchaseDate: Joi.date().optional(),
    items: Joi.array().items(
      Joi.object({
        productId: Joi.string().hex().length(24).required(),
        quantity: Joi.number().integer().min(1).required(),
        purchasePrice: Joi.number().min(0).required(),
        allocations: Joi.array().items(
          Joi.object({
            plantId: Joi.string().hex().length(24).required(),
            quantity: Joi.number().integer().min(1).required()
          })
        ).min(1).required()
      })
    ).min(1).required()
  }),

  stockTransfer: Joi.object({
    fromPlantId: Joi.string().hex().length(24).required(),
    toPlantId: Joi.string().hex().length(24).required(),
    productId: Joi.string().hex().length(24).required(),
    quantity: Joi.number().integer().min(1).required(),
    transferDate: Joi.date().optional(),
    remarks: Joi.string().allow('', null)
  }),

  attendanceBulk: Joi.object({
    date: Joi.date().required(),
    records: Joi.array().items(
      Joi.object({
        employeeId: Joi.string().hex().length(24).required(),
        status: Joi.string().valid('Present', 'Absent', 'Half Day').required()
      })
    ).min(1).required()
  }),

  employee: Joi.object({
    employeeCode: Joi.string().required(),
    employeeName: Joi.string().required(),
    phone: Joi.string().required(),
    address: Joi.string().required(),
    joiningDate: Joi.date().optional(),
    dailyWage: Joi.number().min(0).default(0),
    monthlySalary: Joi.number().min(0).default(0),
    status: Joi.string().valid('Active', 'Inactive').default('Active')
  }),

  salaryGenerate: Joi.object({
    employeeId: Joi.string().hex().length(24).required(),
    month: Joi.string().pattern(/^\d{4}-\d{2}$/).required().messages({
      'string.pattern.base': 'Month must be in YYYY-MM format'
    })
  }),

  expense: Joi.object({
    expenseDate: Joi.date().optional(),
    category: Joi.string().valid('Transport', 'Diesel', 'Labour', 'Electricity', 'Rent', 'Miscellaneous').required(),
    amount: Joi.number().min(0).required(),
    remarks: Joi.string().allow('', null)
  })
};

module.exports = {
  validateRequest,
  schemas
};
