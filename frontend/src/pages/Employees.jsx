import React, { useState, useEffect } from 'react';
import { Table, Card, Button, Input, Modal, Form, Tag, message, Space, Popconfirm, Row, Col, DatePicker, Select, InputNumber, Divider } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, IdcardOutlined } from '@ant-design/icons';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const { Option } = Select;

const Employees = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  
  const [form] = Form.useForm();
  const { hasRole } = useAuth();

  const canEdit = hasRole(['Admin', 'Manager']);
  const isAdmin = hasRole(['Admin']);

  const fetchEmployees = async (page = 1, searchQuery = '') => {
    setLoading(true);
    try {
      const res = await api.get(`/employees?page=${page}&limit=${pagination.pageSize}&search=${searchQuery}`);
      if (res.success) {
        setData(res.data || []);
        setPagination({
          ...pagination,
          current: res.page,
          total: res.total
        });
      }
    } catch (err) {
      message.error(err.message || 'Failed to fetch employees');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees(1);
  }, []);

  const handleTableChange = (pag) => {
    fetchEmployees(pag.current, search);
  };

  const handleSearch = (val) => {
    setSearch(val);
    fetchEmployees(1, val);
  };

  const openAddModal = () => {
    setEditingEmployee(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const openEditModal = (emp) => {
    setEditingEmployee(emp);
    // Parse joining date for form
    const parsed = {
      ...emp,
      joiningDate: emp.joiningDate ? null : undefined // will fall to null in picker, or handle below
    };
    form.setFieldsValue(emp);
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
        joiningDate: values.joiningDate ? values.joiningDate.toDate() : new Date()
      };

      if (editingEmployee) {
        const res = await api.put(`/employees/${editingEmployee._id}`, payload);
        if (res.success) {
          message.success('Employee updated successfully');
          fetchEmployees(pagination.current, search);
          setIsModalOpen(false);
        }
      } else {
        const res = await api.post('/employees', payload);
        if (res.success) {
          message.success('Employee registered successfully');
          fetchEmployees(1, search);
          setIsModalOpen(false);
        }
      }
    } catch (err) {
      message.error(err.message || 'Action failed');
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await api.delete(`/employees/${id}`);
      if (res.success) {
        message.success('Employee deleted successfully');
        fetchEmployees(1, search);
      }
    } catch (err) {
      message.error(err.message || 'Failed to delete employee');
    }
  };

  const columns = [
    {
      title: 'Code',
      dataIndex: 'employeeCode',
      key: 'employeeCode',
      render: (text) => <Tag color="orange" style={{ fontWeight: 600 }}>{text}</Tag>
    },
    {
      title: 'Employee Name',
      dataIndex: 'employeeName',
      key: 'employeeName',
      render: (text) => <b style={{ color: '#0d47a1' }}>{text}</b>
    },
    {
      title: 'Phone Number',
      dataIndex: 'phone',
      key: 'phone'
    },
    {
      title: 'Joining Date',
      dataIndex: 'joiningDate',
      key: 'joiningDate',
      render: (date) => new Date(date).toLocaleDateString()
    },
    {
      title: 'Salary Structure',
      key: 'salary',
      render: (_, record) => {
        if (record.monthlySalary > 0) {
          return <span>Monthly: <b>₹{record.monthlySalary.toLocaleString()}</b></span>;
        } else if (record.dailyWage > 0) {
          return <span>Daily Wage: <b>₹{record.dailyWage}</b></span>;
        }
        return <span style={{ color: '#999' }}>Not set</span>;
      }
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'Active' ? 'success' : 'error'}>
          {status.toUpperCase()}
        </Tag>
      )
    }
  ];

  if (canEdit) {
    columns.push({
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
              title="Delete Employee?"
              description="This deletes employee profile from HR master registry."
              onConfirm={() => handleDelete(record._id)}
              okText="Yes"
              cancelText="No"
            >
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      )
    });
  }

  return (
    <Card 
      title="HR Employee Directory" 
      extra={
        canEdit && (
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={openAddModal}
            style={{ fontWeight: 500 }}
          >
            Register Employee
          </Button>
        )
      }
    >
      <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', maxWidth: '350px' }}>
        <Input
          placeholder="Search Code, Name, Phone..."
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onPressEnter={() => handleSearch(search)}
          allowClear
          onClear={() => handleSearch('')}
        />
        <Button type="primary" onClick={() => handleSearch(search)}>Search</Button>
      </div>

      <Table
        dataSource={data}
        columns={columns}
        rowKey="_id"
        loading={loading}
        pagination={pagination}
        onChange={handleTableChange}
        bordered
      />

      {/* CREATE/EDIT MODAL */}
      <Modal
        title={editingEmployee ? "Edit Employee Specifications" : "Register Employee Profile"}
        open={isModalOpen}
        onCancel={handleCancel}
        footer={null}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{ status: 'Active', dailyWage: 0, monthlySalary: 0 }}
          style={{ marginTop: '16px' }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="employeeCode"
                label="Employee Code ID"
                rules={[
                  { required: true, message: 'Please input code!' },
                  { pattern: /^[A-Z0-9]+$/i, message: 'Alphanumeric only' }
                ]}
              >
                <Input placeholder="e.g. EMP005" disabled={!!editingEmployee} style={{ textTransform: 'uppercase' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="employeeName"
                label="Full Name"
                rules={[{ required: true, message: 'Please input full name!' }]}
              >
                <Input placeholder="e.g Sunita Das" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="phone"
                label="Contact Number"
                rules={[{ required: true, message: 'Please input phone!' }]}
              >
                <Input placeholder="e.g. 9880011222" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="joiningDate" label="Joining Date">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" style={{ margin: '10px 0' }}>Payroll Salary Structure</Divider>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="dailyWage"
                label="Daily Wage (INR)"
                rules={[{ required: true, message: 'Daily wage count required' }]}
              >
                <InputNumber min={0} style={{ width: '100%' }} placeholder="For daily wage workers..." />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="monthlySalary"
                label="Monthly Salary (INR)"
                rules={[{ required: true, message: 'Monthly salary required' }]}
              >
                <InputNumber min={0} style={{ width: '100%' }} placeholder="For salaried employees..." />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="address"
            label="Residential Address"
            rules={[{ required: true, message: 'Address required' }]}
          >
            <Input.TextArea rows={2} placeholder="Complete permanent residential address..." />
          </Form.Item>

          <Form.Item
            name="status"
            label="Employee Status"
            rules={[{ required: true }]}
          >
            <Select>
              <Option value="Active">Active</Option>
              <Option value="Inactive">Inactive</Option>
            </Select>
          </Form.Item>

          <Form.Item style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 0, marginTop: '20px' }}>
            <Space>
              <Button onClick={handleCancel}>Cancel</Button>
              <Button type="primary" htmlType="submit">Submit</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default Employees;
