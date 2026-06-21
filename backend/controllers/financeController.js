const { expenseRepository } = require('../repositories');
const Expense = require('../models/Expense');
const CashBookService = require('../services/CashBookService');

class FinanceController {
  // EXPENSES CRUD
  async createExpense(req, res) {
    try {
      const { expenseDate, category, amount, remarks } = req.body;
      const expense = await expenseRepository.create({ expenseDate, category, amount, remarks });
      
      // Post to Cash Book as expense
      const dateObj = expenseDate ? new Date(expenseDate) : new Date();
      await CashBookService.recordTransaction(dateObj, 'EXPENSE', amount);

      res.status(201).json({ success: true, expense });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async listExpenses(req, res) {
    try {
      const { page, limit, search, category, startDate, endDate } = req.query;
      const filter = {};
      if (category) filter.category = category;
      
      if (startDate || endDate) {
        filter.expenseDate = {};
        if (startDate) filter.expenseDate.$gte = new Date(startDate);
        if (endDate) filter.expenseDate.$lte = new Date(endDate);
      }

      const result = await expenseRepository.findAll({
        filter,
        search,
        searchFields: ['category', 'remarks'],
        page,
        limit,
        sortBy: 'expenseDate:desc'
      });
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async updateExpense(req, res) {
    try {
      const { id } = req.params;
      const { category, amount, remarks, expenseDate } = req.body;

      // Fetch the old expense to adjust the Cash Book difference
      const oldExpense = await expenseRepository.findById(id);
      if (!oldExpense) return res.status(404).json({ success: false, message: 'Expense not found' });

      // Update the expense
      const expense = await expenseRepository.update(id, { category, amount, remarks, expenseDate });

      // Calculate the difference and record it in the cash book
      // To keep it simple: reverse the old amount and add the new amount!
      const oldDate = oldExpense.expenseDate;
      const newDate = expenseDate ? new Date(expenseDate) : oldDate;

      // Reverse old amount
      await CashBookService.recordTransaction(oldDate, 'EXPENSE', -oldExpense.amount);
      // Record new amount
      await CashBookService.recordTransaction(newDate, 'EXPENSE', amount);

      res.json({ success: true, expense });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async deleteExpense(req, res) {
    try {
      const { id } = req.params;
      const expense = await expenseRepository.findById(id);
      if (!expense) return res.status(404).json({ success: false, message: 'Expense not found' });

      // Reverse the cash book amount before deleting
      await CashBookService.recordTransaction(expense.expenseDate, 'EXPENSE', -expense.amount);

      await expenseRepository.delete(id);
      res.json({ success: true, message: 'Expense deleted successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // CASH BOOK ENQUIRIES
  async getDailyCashBook(req, res) {
    try {
      const { date } = req.query; // YYYY-MM-DD
      const cashBook = await CashBookService.getDailyCashBook(date);
      res.json({ success: true, cashBook });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getCashFlowReport(req, res) {
    try {
      const { startDate, endDate } = req.query;
      const report = await CashBookService.getCashFlowReport(startDate, endDate);
      res.json({ success: true, report });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = new FinanceController();
