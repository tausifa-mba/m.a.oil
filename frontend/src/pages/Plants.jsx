import React, { useState, useEffect } from 'react';
import { Table, Card, Button, Input, Modal, Form, Tag, message, Space, Popconfirm, Row, Col, Select } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';

const { Option } = Select;
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const Plants = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlant, setEditingPlant] = useState(null);
  const [form] = Form.useForm();
  const { hasRole } = useAuth();
  
  const canEdit = hasRole(['Admin', 'Manager']);
  const isAdmin = hasRole(['Admin']);

  const fetchPlants = async (page = 1, searchQuery = '') => {
    setLoading(true);
    try {
      const res = await api.get(`/plants?page=${page}&limit=${pagination.pageSize}&search=${searchQuery}`);
      if (res.success) {
        setData(res.data || []);
        setPagination({
          ...pagination,
          current: res.page,
          total: res.total
        });
      }
    } catch (err) {
      console.error(err);
      message.error(err.message || 'Failed to fetch plants');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlants(1, search);
  }, []);

  const handleTableChange = (pag) => {
    fetchPlants(pag.current, search);
  };

  const handleSearch = (val) => {
    setSearch(val);
    fetchPlants(1, val);
  };

  const openAddModal = () => {
    setEditingPlant(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const openEditModal = (plant) => {
    setEditingPlant(plant);
    form.setFieldsValue(plant);
    setIsModalOpen(true);
  };

  const handleCancel = () => {
    setIsModalOpen(false);
    form.resetFields();
  };

  const handleSubmit = async (values) => {
    try {
      if (editingPlant) {
        // Edit mode
        const res = await api.put(`/plants/${editingPlant._id}`, values);
        if (res.success) {
          message.success('Plant updated successfully');
          fetchPlants(pagination.current, search);
          setIsModalOpen(false);
        }
      } else {
        // Add mode
        const res = await api.post('/plants', values);
        if (res.success) {
          message.success('Plant added successfully');
          fetchPlants(1, search);
          setIsModalOpen(false);
        }
      }
    } catch (err) {
      message.error(err.message || 'Action failed');
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await api.delete(`/plants/${id}`);
      if (res.success) {
        message.success('Plant deleted successfully');
        fetchPlants(1, search);
      }
    } catch (err) {
      message.error(err.message || 'Failed to delete plant');
    }
  };

  const columns = [
    {
      title: 'Code',
      dataIndex: 'plantCode',
      key: 'plantCode',
      render: (text) => <Tag color="blue" style={{ fontWeight: 600 }}>{text}</Tag>
    },
    {
      title: 'Plant Name',
      dataIndex: 'plantName',
      key: 'plantName',
      render: (text) => <b style={{ color: '#0d47a1' }}>{text}</b>
    },
    {
      title: 'Manager',
      dataIndex: 'managerName',
      key: 'managerName'
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      key: 'phone'
    },
    {
      title: 'Address',
      dataIndex: 'address',
      key: 'address',
      ellipsis: true
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
              title="Delete Plant?"
              description="This will delete the plant and corresponding inventory records."
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
      title="Plant & Warehouse Registry" 
      extra={
        canEdit && (
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={openAddModal}
            style={{ fontWeight: 500 }}
          >
            Add New Plant
          </Button>
        )
      }
    >
      <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', maxWidth: '350px' }}>
        <Input
          placeholder="Search Code, Name, Manager..."
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

      <Modal
        title={editingPlant ? "Edit Plant Details" : "Create New Plant"}
        open={isModalOpen}
        onCancel={handleCancel}
        footer={null}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{ status: 'Active' }}
          style={{ marginTop: '16px' }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="plantCode"
                label="Plant Code"
                rules={[
                  { required: true, message: 'Please input plant code!' },
                  { pattern: /^[A-Z0-9]+$/i, message: 'Alphanumeric characters only' }
                ]}
              >
                <Input placeholder="e.g. PL005" disabled={!!editingPlant} style={{ textTransform: 'uppercase' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="plantName"
                label="Plant Name"
                rules={[{ required: true, message: 'Please input plant name!' }]}
              >
                <Input placeholder="e.g. Warehouse C" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="managerName"
                label="Manager Name"
                rules={[{ required: true, message: 'Please input manager name!' }]}
              >
                <Input placeholder="e.g. John Doe" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="phone"
                label="Phone Number"
                rules={[{ required: true, message: 'Please input phone number!' }]}
              >
                <Input placeholder="e.g. 9876543210" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="address"
            label="Full Postal Address"
            rules={[{ required: true, message: 'Please input address!' }]}
          >
            <Input.TextArea rows={3} placeholder="Complete warehouse address..." />
          </Form.Item>

          <Form.Item
            name="status"
            label="Plant Status"
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

export default Plants;
