import React, { useState, useEffect } from 'react';
import { Table, Card, Button, Input, Modal, Form, Select, DatePicker, message, Row, Col, Space, InputNumber, Popconfirm, Tag } from 'antd';
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, WalletOutlined } from '@ant-design/icons';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import dayjs from 'dayjs';

const { Option } = Select;

const Expenses = () => {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(undefined);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [form] = Form.useForm();
  
  const { hasRole } = useAuth();
  const isAdmin = hasRole(['Admin']);

  const categories = ['Transport', 'Diesel', 'Labour', 'Electricity', 'Rent', 'Miscellaneous'];

  const fetchExpenses = async (page = 1, searchQuery = '', catQuery = undefined) => {
    setLoading(true);
    try {
      let url = `/expenses?page=${page}&limit=${pagination.pageSize}&search=${searchQuery}`;
      if (catQuery) url += `&category=${catQuery}`;
      
      const res = await api.get(url);
      if (res.success) {
        setExpenses(res.data || []);
        setPagination({
          ...pagination,
          current: res.page,
          total: res.total
        });
      }
    } catch (err) {
      message.error(err.message || 'Failed to fetch expenses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses(1);
  }, []);

  const handleTableChange = (pag) => {
    fetchExpenses(pag.current, search, categoryFilter);
  };

  const handleSearch = (val) => {
    setSearch(val);
    fetchExpenses(1, val, categoryFilter);
  };

  const handleCategoryFilter = (val) => {
    setCategoryFilter(val);
    fetchExpenses(1, search, val);
  };

  const openAddModal = () => {
    setEditingExpense(null);
    form.resetFields();
    form.setFieldsValue({ expenseDate: dayjs() });
    setIsModalOpen(true);
  };

  const openEditModal = (exp) => {
    setEditingExpense(exp);
    form.setFieldsValue({
      ...exp,
      expenseDate: exp.expenseDate ? dayjs(exp.expenseDate) : dayjs()
    });
    setIsModalOpen(true);
  };

  const handleCancel = () => {
    setIsModalOpen(false);
    form.resetFields();
  };

  const handleSubmit = async (values) => {
    try {
      const payload = {
        ...values,
        expenseDate: values.expenseDate ? values.expenseDate.toDate() : new Date()
      };

      if (editingExpense) {
        const res = await api.put(`/expenses/${editingExpense._id}`, payload);
        if (res.success) {
          message.success('Expense recorded successfully! Cash Book reconciled.');
          setIsModalOpen(false);
          fetchExpenses(pagination.current, search, categoryFilter);
        }
      } else {
        const res = await api.post('/expenses', payload);
        if (res.success) {
          message.success('Expense recorded successfully! Cash Book updated.');
          setIsModalOpen(false);
          fetchExpenses(1, search, categoryFilter);
        }
      }
    } catch (err) {
      message.error(err.message || 'Failed to save expense');
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await api.delete(`/expenses/${id}`);
      if (res.success) {
        message.success('Expense record deleted and Cash Book corrected');
        fetchExpenses(1, search, categoryFilter);
      }
    } catch (err) {
      message.error(err.message || 'Failed to delete expense');
    }
  };

  const columns = [
    {
      title: 'Expense Date',
      dataIndex: 'expenseDate',
      key: 'expenseDate',
      render: (date) => new Date(date).toLocaleDateString()
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      render: (cat) => {
        let color = 'default';
        if (cat === 'Diesel') color = 'gold';
        if (cat === 'Transport') color = 'cyan';
        if (cat === 'Labour') color = 'geekblue';
        if (cat === 'Electricity') color = 'orange';
        if (cat === 'Rent') color = 'purple';
        return <Tag color={color}>{cat.toUpperCase()}</Tag>;
      }
    },
    {
      title: 'Amount (₹)',
      dataIndex: 'amount',
      key: 'amount',
      align: 'right',
      render: (val) => <b>₹{Number(val).toFixed(2)}</b>
    },
    {
      title: 'Remarks / Memo',
      dataIndex: 'remarks',
      key: 'remarks',
      ellipsis: true
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space size="middle">
          <Button 
            type="text" 
            icon={<EditOutlined style={{ color: '#1890ff' }} />} 
            onClick={() => openEditModal(record)} 
          />
          {isAdmin && (
            <Popconfirm
              title="Delete Expense?"
              description="This reverses cashbook effects and deletes record."
              onConfirm={() => handleDelete(record._id)}
              okText="Yes"
              cancelText="No"
            >
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <Card 
        title={
          <span>
            <WalletOutlined /> Business Expenses Ledger
          </span>
        }
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openAddModal}>
            Record Expense
          </Button>
        }
      >
        {/* Search and Filters */}
        <div style={{ marginBottom: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <Input
            placeholder="Search Remarks..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onPressEnter={() => handleSearch(search)}
            style={{ width: '250px' }}
            allowClear
            onClear={() => handleSearch('')}
          />
          <Select
            allowClear
            placeholder="Filter Category"
            style={{ width: '200px' }}
            value={categoryFilter}
            onChange={handleCategoryFilter}
          >
            {categories.map(cat => (
              <Option key={cat} value={cat}>{cat}</Option>
            ))}
          </Select>
          <Button type="primary" onClick={() => handleSearch(search)}>Search</Button>
        </div>

        <Table
          dataSource={expenses}
          columns={columns}
          rowKey="_id"
          loading={loading}
          pagination={pagination}
          onChange={handleTableChange}
          bordered
        />
      </Card>

      {/* RECORD MODAL */}
      <Modal
        title={editingExpense ? "Edit Expense Entry" : "Log Business Outward Expense"}
        open={isModalOpen}
        onCancel={handleCancel}
        footer={null}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          style={{ marginTop: '16px' }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="category"
                label="Expense Category"
                rules={[{ required: true, message: 'Please choose category!' }]}
              >
                <Select placeholder="Choose category">
                  {categories.map(cat => (
                    <Option key={cat} value={cat}>{cat}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="amount"
                label="Outflow Amount (INR)"
                rules={[
                  { required: true, message: 'Please input amount!' },
                  { type: 'number', min: 0.01, message: 'Amount must be positive' }
                ]}
              >
                <InputNumber min={0.01} style={{ width: '100%' }} placeholder="₹ Rate" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="expenseDate"
            label="Transaction Date"
            rules={[{ required: true }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="remarks"
            label="Remarks / Spent Detail"
            rules={[{ required: true, message: 'Explain what this was spent on' }]}
          >
            <Input.TextArea rows={2} placeholder="e.g. Paid diesel cost for vehicle WB-34..." />
          </Form.Item>

          <Form.Item style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 0 }}>
            <Space>
              <Button onClick={handleCancel}>Cancel</Button>
              <Button type="primary" htmlType="submit">Submit Entry</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Expenses;
