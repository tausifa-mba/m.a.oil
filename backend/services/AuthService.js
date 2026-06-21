const jwt = require('jsonwebtoken');
const { userRepository } = require('../repositories');

class AuthService {
  generateToken(user) {
    return jwt.sign(
      { id: user._id, role: user.role, name: user.name, email: user.email },
      process.env.JWT_SECRET || 'supersecretkeyforcontainererp2026',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
  }

  async login(email, password) {
    const user = await userRepository.findOne({ email });
    if (!user) {
      throw new Error('Invalid email or password');
    }

    if (user.status !== 'Active') {
      throw new Error('Your account is deactivated. Contact Admin.');
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      throw new Error('Invalid email or password');
    }

    const token = this.generateToken(user);

    // Return user details without password
    const userResponse = {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status
    };

    return { token, user: userResponse };
  }

  async resetPassword(userId, newPassword) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    user.password = newPassword; // Pre-save hook will hash it automatically
    await user.save();
    return { message: 'Password updated successfully' };
  }
}

module.exports = new AuthService();
