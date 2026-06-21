import React, { useState, useEffect } from 'react';
import { Table, Card, Button, Input, Modal, Form, Tag, message, Space, Popconfirm, Row, Col, Drawer, Statistic, Divider } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, BookOutlined } from '@ant-design/icons';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const Suppliers = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  
  // Ledger Drawer States
  const [isLedgerOpen, setIsLedgerOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [ledgerPurchases, setLedgerPurchases] = useState([]);
  const [ledgerTotalPurchased, setLedgerTotalPurchased] = useState(0);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  const [form] = Form.useForm();
  const { hasRole } = useAuth();

  const canEdit = hasRole(['Admin', 'Manager']);
  const isAdmin = hasRole(['Admin']);

  const fetchSuppliers = async (page = 1, searchQuery = '') => {
    setLoading(true);
    try {
      const res = await api.get(`/suppliers?page=${page}&limit=${pagination.pageSize}&search=${searchQuery}`);
      if (res.success) {
        setData(res.data || []);
        setPagination({
          ...pagination,
          current: res.page,
          total: res.total
        });
      }
    } catch (err) {
      message.error(err.message || 'Failed to fetch suppliers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers(1);
  }, []);

  const handleTableChange = (pag) => {
    fetchSuppliers(pag.current, search);
  };

  const handleSearch = (val) => {
    setSearch(val);
    fetchSuppliers(1, val);
  };

  const openAddModal = () => {
    setEditingSupplier(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const openEditModal = (sup) => {
    setEditingSupplier(sup);
    form.setFieldsValue(sup);
    setIsModalOpen(true);
  };

  const handleCancel = () => {
    setIsModalOpen(false);
    form.resetFields();
  };

  const handleSubmit = async (values) => {
    try {
      if (editingSupplier) {
        const res = await api.put(`/suppliers/${editingSupplier._id}`, values);
        if (res.success) {
          message.success('Supplier details updated');
          fetchSuppliers(pagination.current, search);
          setIsModalOpen(false);
        }
      } else {
        const res = await api.post('/suppliers', values);
        if (res.success) {
          message.success('Supplier profile created');
          fetchSuppliers(1, search);
          setIsModalOpen(false);
        }
      }
    } catch (err) {
      message.error(err.message || 'Action failed');
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await api.delete(`/suppliers/${id}`);
      if (res.success) {
        message.success('Supplier deleted successfully');
        fetchSuppliers(1, search);
      }
    } catch (err) {
      message.error(err.message || 'Failed to delete supplier');
    }
  };

  // Ledger details
  const openLedger = async (sup) => {
    setSelectedSupplier(sup);
    setIsLedgerOpen(true);
    setLedgerLoading(true);
    try {
      const res = await api.get(`/suppliers/${sup._id}/ledger`);
      if (res.success) {
        setLedgerPurchases(res.purchases || []);
        setLedgerTotalPurchased(res.totalPurchased || 0);
      }
    } catch (err) {
      message.error('Failed to load supplier purchases ledger');
    } finally {
      setLedgerLoading(false);
    }
  };

  const columns = [
    {
      title: 'Supplier Name',
      dataIndex: 'supplierName',
      key: 'supplierName',
      render: (text) => <b style={{ color: '#0d47a1' }}>{text}</b>
    },
    {
      title: 'GSTIN',
      dataIndex: 'gstNumber',
      key: 'gstNumber',
      render: (text) => text ? <Tag color="blue">{text}</Tag> : <Text type="secondary">N/A</Text>
    },
    {
      title: 'Phone',
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
      title: 'Address',
      dataIndex: 'address',
      key: 'address',
      ellipsis: true
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
            title="Supplier Purchase History Ledger"
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
              title="Delete Supplier?"
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
      title="Supplier / Vendor Registry" 
      extra={
        canEdit && (
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={openAddModal}
            style={{ fontWeight: 500 }}
          >
            Add Supplier
          </Button>
        )
      }
    >
      <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', maxWidth: '350px' }}>
        <Input
          placeholder="Search Supplier Name, Phone..."
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
        title={editingSupplier ? "Edit Supplier Specifications" : "Register New Supplier/Vendor"}
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
            name="supplierName"
            label="Supplier / Business Name"
            rules={[{ required: true, message: 'Please input supplier name!' }]}
          >
            <Input placeholder="e.g. Apex Drums Ltd" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="phone"
                label="Phone Number"
                rules={[{ required: true, message: 'Please input phone!' }]}
              >
                <Input placeholder="e.g. 9870011223" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="email"
                label="Email Address"
                rules={[{ type: 'email', message: 'Enter valid email!' }]}
              >
                <Input placeholder="e.g. sales@apexdrums.com" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="gstNumber" label="GSTIN Registration Number">
            <Input placeholder="15-digit alphanumeric GST code" style={{ textTransform: 'uppercase' }} />
          </Form.Item>

          <Form.Item
            name="address"
            label="Full Address / Registered Office"
            rules={[{ required: true, message: 'Please input address!' }]}
          >
            <Input.TextArea rows={3} placeholder="Complete office/warehouse address..." />
          </Form.Item>

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
        title={selectedSupplier ? `Supplier Statement: ${selectedSupplier.supplierName}` : 'Supplier Ledger'}
        placement="right"
        width={650}
        onClose={() => setIsLedgerOpen(false)}
        open={isLedgerOpen}
      >
        {selectedSupplier && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <Row gutter={16}>
              <Col span={12}>
                <Statistic title="Total Purchasing Outflow" value={ledgerTotalPurchased} precision={2} prefix="₹" valueStyle={{ color: '#c62828', fontWeight: 'bold' }} />
              </Col>
              <Col span={12}>
                <Statistic title="Purchase Entries" value={ledgerPurchases.length} valueStyle={{ fontWeight: 'bold' }} />
              </Col>
            </Row>

            <Divider style={{ margin: '10px 0' }} />

            <h4>Inward Purchase Logs & Deliveries</h4>
            <Table
              dataSource={ledgerPurchases}
              rowKey="_id"
              loading={ledgerLoading}
              size="small"
              bordered
              columns={[
                {
                  title: 'Date',
                  dataIndex: 'date',
                  key: 'date',
                  render: (date) => new Date(date).toLocaleDateString()
                },
                {
                  title: 'Product',
                  dataIndex: ['productId', 'productName'],
                  key: 'productName'
                },
                {
                  title: 'Received Location',
                  dataIndex: ['plantId', 'plantName'],
                  key: 'plantName',
                  render: (text) => <Tag color="blue">{text}</Tag>
                },
                {
                  title: 'Qty',
                  dataIndex: 'quantity',
                  key: 'quantity',
                  align: 'right'
                },
                {
                  title: 'Rate',
                  dataIndex: 'rate',
                  key: 'rate',
                  align: 'right',
                  render: (r) => `₹${r.toFixed(2)}`
                },
                {
                  title: 'Subtotal',
                  key: 'subtotal',
                  align: 'right',
                  render: (_, rec) => <b>₹{(rec.quantity * rec.rate).toFixed(2)}</b>
                }
              ]}
            />
          </div>
        )}
      </Drawer>
    </Card>
  );
};

export default Suppliers;
