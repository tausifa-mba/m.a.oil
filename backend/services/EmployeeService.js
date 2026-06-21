const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const Salary = require('../models/Salary');
const CashBookService = require('./CashBookService');
const mongoose = require('mongoose');

class EmployeeService {
  async bulkMarkAttendance(dateString, attendanceRecords) {
    const targetDate = new Date(dateString);
    targetDate.setUTCHours(0, 0, 0, 0);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const results = [];
      for (const record of attendanceRecords) {
        const { employeeId, status } = record;

        // Use findOneAndUpdate with upsert to prevent unique constraint failures
        const attendance = await Attendance.findOneAndUpdate(
          { employeeId, date: targetDate },
          { status },
          { upsert: true, new: true, session }
        );
        results.push(attendance);
      }

      await session.commitTransaction();
      session.endSession();
      return results;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }

  async getMonthlyAttendanceReport(monthString) {
    // monthString is YYYY-MM
    const [year, month] = monthString.split('-').map(Number);
    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const employees = await Employee.find({ status: 'Active' });
    const attendanceLogs = await Attendance.find({
      date: { $gte: startDate, $lte: endDate }
    });

    // Structure the report
    const report = employees.map(emp => {
      const empLogs = attendanceLogs.filter(log => String(log.employeeId) === String(emp._id));
      const presentCount = empLogs.filter(log => log.status === 'Present').length;
      const absentCount = empLogs.filter(log => log.status === 'Absent').length;
      const halfDayCount = empLogs.filter(log => log.status === 'Half Day').length;

      return {
        employee: emp,
        present: presentCount,
        absent: absentCount,
        halfDay: halfDayCount,
        totalPresentDays: presentCount + (halfDayCount * 0.5)
      };
    });

    return report;
  }

  async generateSalary(employeeId, monthString) {
    const [year, month] = monthString.split('-').map(Number);
    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    const totalDaysInMonth = new Date(year, month, 0).getDate();

    // Check if salary already generated
    const existingSalary = await Salary.findOne({ employeeId, month: monthString });
    if (existingSalary) {
      throw new Error('Salary already generated for this employee for the selected month');
    }

    const employee = await Employee.findById(employeeId);
    if (!employee) throw new Error('Employee not found');

    // Count present days
    const logs = await Attendance.find({
      employeeId,
      date: { $gte: startDate, $lte: endDate }
    });

    const presentCount = logs.filter(log => log.status === 'Present').length;
    const halfDayCount = logs.filter(log => log.status === 'Half Day').length;
    const totalPresentDays = presentCount + (halfDayCount * 0.5);

    // Calculate Salary Amount
    let salaryAmount = 0;
    if (employee.monthlySalary > 0) {
      // Pro-rata based on days in the month
      salaryAmount = Math.round((employee.monthlySalary / totalDaysInMonth) * totalPresentDays * 100) / 100;
    } else if (employee.dailyWage > 0) {
      // Total daily wage
      salaryAmount = employee.dailyWage * totalPresentDays;
    }

    return await Salary.create({
      employeeId,
      month: monthString,
      presentDays: totalPresentDays,
      salaryAmount,
      paymentStatus: 'Pending'
    });
  }

  async processSalaryPayment(salaryId, paymentDateString) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const salary = await Salary.findById(salaryId).session(session);
      if (!salary) throw new Error('Salary record not found');
      if (salary.paymentStatus === 'Paid') throw new Error('Salary already paid');

      const paymentDate = paymentDateString ? new Date(paymentDateString) : new Date();

      salary.paymentStatus = 'Paid';
      salary.paymentDate = paymentDate;
      await salary.save({ session });

      // Record to Cash Book as expense
      await CashBookService.recordTransaction(paymentDate, 'EXPENSE', salary.salaryAmount, session);

      await session.commitTransaction();
      session.endSession();

      return salary;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }

  async getSalaryHistory({ employeeId = '', month = '', paymentStatus = '' }) {
    const query = {};
    if (employeeId) query.employeeId = employeeId;
    if (month) query.month = month;
    if (paymentStatus) query.paymentStatus = paymentStatus;

    return await Salary.find(query).populate('employeeId').sort({ createdAt: -1 });
  }
}

module.exports = new EmployeeService();
