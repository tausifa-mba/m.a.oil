const { employeeRepository } = require('../repositories');
const EmployeeService = require('../services/EmployeeService');

class HrController {
  // EMPLOYEE CRUD
  async createEmployee(req, res) {
    try {
      const employee = await employeeRepository.create(req.body);
      res.status(201).json({ success: true, employee });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async listEmployees(req, res) {
    try {
      const { page, limit, search, status } = req.query;
      const filter = {};
      if (status) filter.status = status;

      const result = await employeeRepository.findAll({
        filter,
        search,
        searchFields: ['employeeCode', 'employeeName', 'phone', 'address'],
        page,
        limit,
        sortBy: 'employeeCode:asc'
      });
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getEmployeeById(req, res) {
    try {
      const employee = await employeeRepository.findById(req.params.id);
      if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });
      res.json({ success: true, employee });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async updateEmployee(req, res) {
    try {
      const employee = await employeeRepository.update(req.params.id, req.body);
      if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });
      res.json({ success: true, employee });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async deleteEmployee(req, res) {
    try {
      const employee = await employeeRepository.delete(req.params.id);
      if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });
      res.json({ success: true, message: 'Employee deleted successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // ATTENDANCE ACTIONS
  async bulkMarkAttendance(req, res) {
    try {
      const { date, records } = req.body;
      const logs = await EmployeeService.bulkMarkAttendance(date, records);
      res.json({ success: true, count: logs.length, attendance: logs });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async getAttendanceReport(req, res) {
    try {
      const { month } = req.query; // YYYY-MM
      if (!month) return res.status(400).json({ success: false, message: 'Month query parameter (YYYY-MM) is required' });

      const report = await EmployeeService.getMonthlyAttendanceReport(month);
      res.json({ success: true, report });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // SALARY ACTIONS
  async generateSalary(req, res) {
    try {
      const { employeeId, month } = req.body; // employeeId, month (YYYY-MM)
      const salary = await EmployeeService.generateSalary(employeeId, month);
      res.status(201).json({ success: true, salary });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async processSalaryPayment(req, res) {
    try {
      const { id } = req.params;
      const { paymentDate } = req.body;
      const salary = await EmployeeService.processSalaryPayment(id, paymentDate);
      res.json({ success: true, salary });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async listSalaries(req, res) {
    try {
      const { employeeId, month, paymentStatus } = req.query;
      const history = await EmployeeService.getSalaryHistory({ employeeId, month, paymentStatus });
      res.json({ success: true, salaries: history });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = new HrController();
