import React, { useState, useEffect } from 'react';
import { Table, Card, Button, Input, Modal, Form, Tag, message, Space, Popconfirm, Row, Col, Drawer, Statistic, Divider } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, BookOutlined } from '@ant-design/icons';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';



const Customers = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  
  // Ledger Drawer States
  const [isLedgerOpen, setIsLedgerOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [ledgerInvoices, setLedgerInvoices] = useState([]);
  const [ledgerTotalSpent, setLedgerTotalSpent] = useState(0);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  const [form] = Form.useForm();
  const { hasRole } = useAuth();
  
  const canEdit = hasRole(['Admin', 'Manager']);
  const isAdmin = hasRole(['Admin']);

  const fetchCustomers = async (page = 1, searchQuery = '') => {
    setLoading(true);
    try {
      const res = await api.get(`/customers?page=${page}&limit=${pagination.pageSize}&search=${searchQuery}`);
      if (res.success) {
        setData(res.data || []);
        setPagination({
          ...pagination,
          current: res.page,
          total: res.total
        });
      }
    } catch (err) {
      message.error(err.message || 'Failed to fetch customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers(1);
  }, []);

  const handleTableChange = (pag) => {
    fetchCustomers(pag.current, search);
  };

  const handleSearch = (val) => {
    setSearch(val);
    fetchCustomers(1, val);
  };

  const openAddModal = () => {
    setEditingCustomer(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const openEditModal = (cust) => {
    setEditingCustomer(cust);
    form.setFieldsValue(cust);
    setIsModalOpen(true);
  };

  const handleCancel = () => {
    setIsModalOpen(false);
    form.resetFields();
  };

  const handleSubmit = async (values) => {
    try {
      if (editingCustomer) {
        const res = await api.put(`/customers/${editingCustomer._id}`, values);
        if (res.success) {
          message.success('Customer updated successfully');
          fetchCustomers(pagination.current, search);
          setIsModalOpen(false);
        }
      } else {
        const res = await api.post('/customers', values);
        if (res.success) {
          message.success('Customer registered successfully');
          fetchCustomers(1, search);
          setIsModalOpen(false);
        }
      }
    } catch (err) {
      message.error(err.message || 'Action failed');
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await api.delete(`/customers/${id}`);
      if (res.success) {
        message.success('Customer profile deleted');
        fetchCustomers(1, search);
      }
    } catch (err) {
      message.error(err.message || 'Failed to delete customer');
    }
  };

  // Ledger actions
  const openLedger = async (cust) => {
    setSelectedCustomer(cust);
    setIsLedgerOpen(true);
    setLedgerLoading(true);
    try {
      const res = await api.get(`/customers/${cust._id}/ledger`);
      if (res.success) {
        setLedgerInvoices(res.invoices || []);
        setLedgerTotalSpent(res.totalSpent || 0);
      }
    } catch (err) {
      message.error('Failed to load ledger details');
    } finally {
      setLedgerLoading(false);
    }
  };

  const columns = [
    {
      title: 'Customer Name',
      dataIndex: 'customerName',
      key: 'customerName',
      render: (text) => <b style={{ color: '#0d47a1' }}>{text}</b>
    },
    {
      title: 'GSTIN',
      dataIndex: 'gstNumber',
      key: 'gstNumber',
      render: (text) => text ? <Tag color="blue">{text}</Tag> : <Text type="secondary">N/A</Text>
    },
    {
      title: 'Contact Phone',
      dataIndex: 'phone',
      key: 'phone'
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      render: (text) => text || 'N/A'
    },
    {
      title: 'Location',
      key: 'location',
      render: (_, record) => <span>{record.city}, {record.state}</span>
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space size="middle">
          <Button 
            type="text" 
            icon={<BookOutlined style={{ color: '#1b5e20' }} />} 
            onClick={() => openLedger(record)}
            title="Customer Ledger Statement"
          />
          {canEdit && (
            <Button 
              type="text" 
              icon={<EditOutlined style={{ color: '#1890ff' }} />} 
              onClick={() => openEditModal(record)} 
            />
          )}
          {isAdmin && (
            <Popconfirm
              title="Delete Customer?"
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
    <Card 
      title="Customer / Client Registry" 
      extra={
        canEdit && (
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={openAddModal}
            style={{ fontWeight: 500 }}
          >
            Register Customer
          </Button>
        )
      }
    >
      <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', maxWidth: '350px' }}>
        <Input
          placeholder="Search Name, Phone, City..."
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
        title={editingCustomer ? "Edit Customer Details" : "Register Billed Client"}
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
          <Form.Item
            name="customerName"
            label="Customer Name / Business Title"
            rules={[{ required: true, message: 'Please input customer name!' }]}
          >
            <Input placeholder="e.g. Alfa Logistics Ltd" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="phone"
                label="Phone Number"
                rules={[{ required: true, message: 'Please input phone!' }]}
              >
                <Input placeholder="e.g. 9830012345" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="email"
                label="Email Address"
                rules={[{ type: 'email', message: 'Enter valid email!' }]}
              >
                <Input placeholder="e.g. accounts@alfalogistics.com" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="gstNumber" label="GSTIN Registration Number">
            <Input placeholder="15-digit alphanumeric GST code" style={{ textTransform: 'uppercase' }} />
          </Form.Item>

          <Form.Item
            name="address"
            label="Street Address / Registered Office"
            rules={[{ required: true, message: 'Required' }]}
          >
            <Input placeholder="Door no, Road, Area..." />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="city"
                label="City"
                rules={[{ required: true, message: 'Required' }]}
              >
                <Input placeholder="e.g. Kolkata" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="state"
                label="State"
                rules={[{ required: true, message: 'Required' }]}
              >
                <Input placeholder="e.g. West Bengal" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 0 }}>
            <Space>
              <Button onClick={handleCancel}>Cancel</Button>
              <Button type="primary" htmlType="submit">Submit</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* LEDGER DRAWER */}
      <Drawer
        title={selectedCustomer ? `Customer Ledger: ${selectedCustomer.customerName}` : 'Customer Ledger'}
        placement="right"
        width={650}
        onClose={() => setIsLedgerOpen(false)}
        open={isLedgerOpen}
      >
        {selectedCustomer && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <Row gutter={16}>
              <Col span={12}>
                <Statistic title="Total Business Value" value={ledgerTotalSpent} precision={2} prefix="₹" valueStyle={{ color: '#1b5e20', fontWeight: 'bold' }} />
              </Col>
              <Col span={12}>
                <Statistic title="Invoices Count" value={ledgerInvoices.length} valueStyle={{ fontWeight: 'bold' }} />
              </Col>
            </Row>

            <Divider style={{ margin: '10px 0' }} />

            <h4>Billing Statements & Receipts</h4>
            <Table
              dataSource={ledgerInvoices}
              rowKey="_id"
              loading={ledgerLoading}
              size="small"
              bordered
              columns={[
                {
                  title: 'Date',
                  dataIndex: 'invoiceDate',
                  key: 'invoiceDate',
                  render: (date) => new Date(date).toLocaleDateString()
                },
                {
                  title: 'Invoice Number',
                  dataIndex: 'invoiceNumber',
                  key: 'invoiceNumber',
                  render: (num) => <Tag color="blue">{num}</Tag>
                },
                {
                  title: 'Subtotal',
                  dataIndex: 'subtotal',
                  key: 'subtotal',
                  render: (v) => `₹${v.toFixed(2)}`
                },
                {
                  title: 'Grand Total',
                  dataIndex: 'grandTotal',
                  key: 'grandTotal',
                  render: (v) => <b>₹{v.toFixed(2)}</b>
                }
              ]}
            />
          </div>
        )}
      </Drawer>
    </Card>
  );
};

export default Customers;
