import React, { useState, useEffect } from 'react';
import { Table, Card, Button, Form, Select, InputNumber, DatePicker, message, Row, Col, Space, Tag, Input } from 'antd';
import { PlusOutlined, SwapOutlined, HistoryOutlined } from '@ant-design/icons';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const { Option } = Select;

const Transfers = () => {
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [plants, setPlants] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [availableStockMsg, setAvailableStockMsg] = useState('');
  const [form] = Form.useForm();
  const { hasRole } = useAuth();
  
  const canTransfer = hasRole(['Admin', 'Manager']);

  const fetchTransfers = async (page = 1) => {
    setLoading(true);
    try {
      const res = await api.get(`/transfers?page=${page}&limit=${pagination.pageSize}`);
      if (res.success) {
        setTransfers(res.data || []);
        setPagination({
          ...pagination,
          current: res.page,
          total: res.total
        });
      }
    } catch (err) {
      message.error(err.message || 'Failed to load transfers');
    } finally {
      setLoading(false);
    }
  };

  const fetchDependencies = async () => {
    try {
      const [productsRes, plantsRes] = await Promise.all([
        api.get('/products?limit=100'),
        api.get('/plants?limit=100')
      ]);
      if (productsRes.success) setProducts(productsRes.data || []);
      if (plantsRes.success) setPlants(plantsRes.data || []);
    } catch (err) {
      console.error('Failed to load dependency metadata:', err);
    }
  };

  useEffect(() => {
    fetchTransfers(1);
    fetchDependencies();
  }, []);

  const checkSourceStock = async () => {
    const fromPlantId = form.getFieldValue('fromPlantId');
    const productId = form.getFieldValue('productId');
    
    if (fromPlantId && productId) {
      try {
        const res = await api.get(`/products/${productId}/inventory`);
        if (res.success) {
          const match = (res.stock || []).find(s => s.plantId?._id === fromPlantId);
          const avail = match ? match.availableQuantity : 0;
          setAvailableStockMsg(`Stock available at source plant: ${avail} units`);
        }
      } catch (err) {
        console.error(err);
      }
    } else {
      setAvailableStockMsg('');
    }
  };

  const handleTableChange = (pag) => {
    fetchTransfers(pag.current);
  };

  const handleSubmit = async (values) => {
    if (values.fromPlantId === values.toPlantId) {
      return message.error('Source and Destination plants must be different');
    }

    try {
      const res = await api.post('/transfers', {
        fromPlantId: values.fromPlantId,
        toPlantId: values.toPlantId,
        productId: values.productId,
        quantity: values.quantity,
        remarks: values.remarks,
        transferDate: values.transferDate ? values.transferDate.toDate() : new Date()
      });

      if (res.success) {
        message.success('Stock transfer executed successfully');
        form.resetFields();
        setAvailableStockMsg('');
        setIsFormOpen(false);
        fetchTransfers(1);
      }
    } catch (err) {
      message.error(err.message || 'Transfer failed');
    }
  };

  const columns = [
    {
      title: 'Transfer Date',
      dataIndex: 'transferDate',
      key: 'transferDate',
      render: (date) => new Date(date).toLocaleDateString()
    },
    {
      title: 'Product',
      dataIndex: ['productId', 'productName'],
      key: 'productName',
      render: (text, record) => (
        <span>
          <b>{text}</b> <br />
          <span style={{ fontSize: '11px', color: '#888' }}>
            Code: {record.productId?.productCode}
          </span>
        </span>
      )
    },
    {
      title: 'Source Plant (Out)',
      dataIndex: ['fromPlantId', 'plantName'],
      key: 'fromPlantName',
      render: (text) => <Tag color="volcano">{text}</Tag>
    },
    {
      title: 'Destination Plant (In)',
      dataIndex: ['toPlantId', 'plantName'],
      key: 'toPlantName',
      render: (text) => <Tag color="green">{text}</Tag>
    },
    {
      title: 'Qty Transferred',
      dataIndex: 'quantity',
      key: 'quantity',
      align: 'right',
      render: (val) => <b>{val} Nos</b>
    },
    {
      title: 'Remarks',
      dataIndex: 'remarks',
      key: 'remarks',
      ellipsis: true
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {canTransfer && (
        <Card 
          title="Stock Transfer Request Form"
          open={isFormOpen}
          extra={<Button onClick={() => setIsFormOpen(false)}>Collapse Form</Button>}
          style={{ display: isFormOpen ? 'block' : 'none' }}
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
          >
            <Row gutter={16}>
              <Col xs={24} sm={8}>
                <Form.Item
                  name="productId"
                  label="Select Product to Transfer"
                  rules={[{ required: true, message: 'Please select a product!' }]}
                >
                  <Select 
                    placeholder="Select Product" 
                    showSearch 
                    optionFilterProp="children"
                    onChange={checkSourceStock}
                  >
                    {products.map(p => (
                      <Option key={p._id} value={p._id}>{p.productName} ({p.productCode})</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item
                  name="fromPlantId"
                  label="Source Location (From)"
                  rules={[{ required: true, message: 'Select source plant' }]}
                >
                  <Select 
                    placeholder="Select Source Plant"
                    onChange={checkSourceStock}
                  >
                    {plants.map(pl => (
                      <Option key={pl._id} value={pl._id}>{pl.plantName} ({pl.plantCode})</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item
                  name="toPlantId"
                  label="Destination Location (To)"
                  rules={[{ required: true, message: 'Select destination plant' }]}
                >
                  <Select placeholder="Select Destination Plant">
                    {plants.map(pl => (
                      <Option key={pl._id} value={pl._id}>{pl.plantName} ({pl.plantCode})</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            {availableStockMsg && (
              <div style={{ marginBottom: '16px', fontWeight: '500', color: '#0d47a1' }}>
                {availableStockMsg}
              </div>
            )}

            <Row gutter={16}>
              <Col xs={24} sm={8}>
                <Form.Item
                  name="quantity"
                  label="Quantity to Move"
                  rules={[{ required: true, message: 'Enter quantity' }]}
                >
                  <InputNumber min={1} style={{ width: '100%' }} placeholder="Enter count..." />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item name="transferDate" label="Transfer Date">
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item name="remarks" label="Transfer Remarks">
                  <Input placeholder="Reason for transfer, truck number, etc." />
                </Form.Item>
              </Col>
            </Row>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Space>
                <Button onClick={() => { form.resetFields(); setAvailableStockMsg(''); setIsFormOpen(false); }}>Cancel</Button>
                <Button type="primary" htmlType="submit" icon={<SwapOutlined />}>Execute Transfer</Button>
              </Space>
            </div>
          </Form>
        </Card>
      )}

      <Card 
        title={
          <span>
            <HistoryOutlined /> Stock Movements & Transfers Log
          </span>
        }
        extra={
          canTransfer && !isFormOpen && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsFormOpen(true)}>
              New Stock Transfer
            </Button>
          )
        }
      >
        <Table
          dataSource={transfers}
          columns={columns}
          rowKey="_id"
          loading={loading}
          pagination={pagination}
          onChange={handleTableChange}
          bordered
        />
      </Card>
    </div>
  );
};

export default Transfers;
