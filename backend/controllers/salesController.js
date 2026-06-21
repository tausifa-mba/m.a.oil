const { customerRepository } = require('../repositories');
const InvoiceService = require('../services/InvoiceService');
const Invoice = require('../models/Invoice');
const InvoiceItem = require('../models/InvoiceItem');

class SalesController {
  // CUSTOMER CRUD
  async createCustomer(req, res) {
    try {
      const customer = await customerRepository.create(req.body);
      res.status(201).json({ success: true, customer });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async listCustomers(req, res) {
    try {
      const { page, limit, search } = req.query;
      const result = await customerRepository.findAll({
        search,
        searchFields: ['customerName', 'phone', 'email', 'city', 'state'],
        page,
        limit,
        sortBy: 'customerName:asc'
      });
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getCustomerById(req, res) {
    try {
      const customer = await customerRepository.findById(req.params.id);
      if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
      res.json({ success: true, customer });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async updateCustomer(req, res) {
    try {
      const customer = await customerRepository.update(req.params.id, req.body);
      if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
      res.json({ success: true, customer });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async deleteCustomer(req, res) {
    try {
      const customer = await customerRepository.delete(req.params.id);
      if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
      res.json({ success: true, message: 'Customer deleted successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // CUSTOMER PURCHASE LEDGER
  async getCustomerLedger(req, res) {
    try {
      const { id } = req.params;
      const customer = await customerRepository.findById(id);
      if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });

      // Invoices purchased by customer
      const invoices = await Invoice.find({ customer: id })
        .populate('sourcePlantId')
        .populate({
          path: 'products',
          populate: { path: 'productId' }
        })
        .sort({ invoiceDate: -1 });

      const totalSpent = invoices.reduce((sum, inv) => sum + inv.grandTotal, 0);

      res.json({
        success: true,
        customer,
        invoices,
        totalSpent
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // INVOICES ACTIONS
  async createInvoice(req, res) {
    try {
      const invoice = await InvoiceService.createInvoice(req.body, req.user._id);
      res.status(201).json({ success: true, invoice });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async listInvoices(req, res) {
    try {
      const result = await InvoiceService.listInvoices(req.query);
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getInvoiceById(req, res) {
    try {
      const invoice = await InvoiceService.getInvoiceById(req.params.id);
      if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });
      res.json({ success: true, invoice });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getInvoicePDF(req, res) {
    try {
      const invoice = await InvoiceService.getInvoiceById(req.params.id);
      if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=Invoice-${invoice.invoiceNumber}.pdf`);

      const { generateInvoicePDF } = require('../utils/pdfGenerator');
      await generateInvoicePDF(invoice, res);
    } catch (error) {
      console.error('PDF Generation Error:', error);
      res.status(500).json({ success: false, message: 'Failed to compile and stream invoice PDF' });
    }
  }
}

module.exports = new SalesController();
