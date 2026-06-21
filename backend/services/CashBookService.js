const CashBook = require('../models/CashBook');

class CashBookService {
  async getDailyCashBook(dateString) {
    const targetDate = dateString ? new Date(dateString) : new Date();
    targetDate.setUTCHours(0, 0, 0, 0);

    let cashBook = await CashBook.findOne({ date: targetDate });
    if (!cashBook) {
      // Find the most recent previous cashbook to get the closing balance
      const prevCashBook = await CashBook.findOne({ date: { $lt: targetDate } }).sort({ date: -1 });
      const openingBalance = prevCashBook ? prevCashBook.closingBalance : 0;

      cashBook = await CashBook.create({
        date: targetDate,
        openingBalance,
        income: 0,
        expenses: 0,
        closingBalance: openingBalance
      });
    }

    return cashBook;
  }

  async recordTransaction(date, type, amount, session = null) {
    const normalizedDate = new Date(date);
    normalizedDate.setUTCHours(0, 0, 0, 0);

    let query = CashBook.findOne({ date: normalizedDate });
    if (session) query = query.session(session);
    let cashBook = await query.exec();

    if (!cashBook) {
      // Fetch the last record before this date to find the opening balance
      let prevQuery = CashBook.findOne({ date: { $lt: normalizedDate } }).sort({ date: -1 });
      if (session) prevQuery = prevQuery.session(session);
      const prevCashBook = await prevQuery.exec();
      const openingBalance = prevCashBook ? prevCashBook.closingBalance : 0;

      if (session) {
        const [newCb] = await CashBook.create([{
          date: normalizedDate,
          openingBalance,
          income: 0,
          expenses: 0,
          closingBalance: openingBalance
        }], { session });
        cashBook = newCb;
      } else {
        cashBook = await CashBook.create({
          date: normalizedDate,
          openingBalance,
          income: 0,
          expenses: 0,
          closingBalance: openingBalance
        });
      }
    }

    if (type === 'INCOME') {
      cashBook.income += amount;
    } else if (type === 'EXPENSE') {
      cashBook.expenses += amount;
    }

    // pre-save hook will compute closingBalance
    if (session) {
      await cashBook.save({ session });
    } else {
      await cashBook.save();
    }

    // Cascade updates to all future dates
    let currentClosing = cashBook.openingBalance + cashBook.income - cashBook.expenses;
    
    let futureQuery = CashBook.find({ date: { $gt: normalizedDate } }).sort({ date: 1 });
    if (session) futureQuery = futureQuery.session(session);
    const nextCashBooks = await futureQuery.exec();

    for (let cb of nextCashBooks) {
      cb.openingBalance = currentClosing;
      cb.closingBalance = cb.openingBalance + cb.income - cb.expenses;
      if (session) {
        await cb.save({ session });
      } else {
        await cb.save();
      }
      currentClosing = cb.closingBalance;
    }
  }

  async getCashFlowReport(startDate, endDate) {
    const filter = {};
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setUTCHours(0,0,0,0);
        filter.date.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setUTCHours(23,59,59,999);
        filter.date.$lte = end;
      }
    }

    return await CashBook.find(filter).sort({ date: 1 });
  }
}

module.exports = new CashBookService();
