const CreditOrderService = require('../services/CreditOrderService');

exports.createCreditOrder = async (req, res, next) => {
  try {
    const order = await CreditOrderService.createCreditOrder(req.body, req.user._id);
    res.status(201).json({ success: true, data: order });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.listCreditOrders = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    
    const result = await CreditOrderService.listCreditOrders({ search }, page, limit);
    res.status(200).json({
      success: true,
      data: result.data,
      total: result.total,
      page: result.page,
      limit: result.limit
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getCreditOrderById = async (req, res, next) => {
  try {
    const order = await CreditOrderService.getCreditOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Credit order not found' });
    }
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
