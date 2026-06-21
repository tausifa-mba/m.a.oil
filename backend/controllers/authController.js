const User = require('../models/User');
const AuthService = require('../services/AuthService');
const { userRepository } = require('../repositories');

class AuthController {
  async login(req, res) {
    try {
      const { email, password } = req.body;
      const result = await AuthService.login(email, password);
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async getProfile(req, res) {
    try {
      res.json({ success: true, user: req.user });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async resetPassword(req, res) {
    try {
      const { userId, newPassword } = req.body;
      
      // Staff can only reset their own password. Admins/Managers can reset anyone.
      if (req.user.role === 'Staff' && String(req.user._id) !== String(userId)) {
        return res.status(403).json({ success: false, message: 'You are not authorized to reset another user\'s password' });
      }

      const result = await AuthService.resetPassword(userId, newPassword);
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  // Admin User CRUD
  async register(req, res) {
    try {
      const { name, email, phone, password, role } = req.body;
      
      const existingUser = await userRepository.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ success: false, message: 'Email already registered' });
      }

      const user = await userRepository.create({ name, email, phone, password, role });
      res.status(201).json({
        success: true,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          status: user.status
        }
      });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async listUsers(req, res) {
    try {
      const { page, limit, search } = req.query;
      const result = await userRepository.findAll({
        search,
        searchFields: ['name', 'email', 'phone'],
        page,
        limit,
        sortBy: 'name:asc'
      });
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async updateUser(req, res) {
    try {
      const { id } = req.params;
      const { name, phone, role, status } = req.body;

      const user = await userRepository.update(id, { name, phone, role, status });
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });

      res.json({ success: true, user });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async deleteUser(req, res) {
    try {
      const { id } = req.params;
      const user = await userRepository.delete(id);
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });

      res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = new AuthController();
