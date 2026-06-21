import React, { useState, useEffect } from 'react';
import { Table, Card, Button, Form, Select, InputNumber, DatePicker, message, Row, Col, Divider, Space, Tag, Input, Alert } from 'antd';
import { PlusOutlined, SearchOutlined, HistoryOutlined, DeleteOutlined, PlusCircleOutlined } from '@ant-design/icons';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import dayjs from 'dayjs';

const { Option } = Select;

const Purchases = () => {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [plants, setPlants] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [filterPlant, setFilterPlant] = useState(undefined);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form] = Form.useForm();
  const { hasRole } = useAuth();
  
  const canRecord = hasRole(['Admin', 'Manager']);

  const fetchPurchases = async (page = 1, plantId = undefined) => {
    setLoading(true);
    try {
      let url = `/purchases?page=${page}&limit=${pagination.pageSize}`;
      if (plantId) url += `&plantId=${plantId}`;
      const res = await api.get(url);
      if (res.success) {
        setPurchases(res.data || []);
        setPagination({
          ...pagination,
          current: res.page,
          total: res.total
        });
      }
    } catch (err) {
      message.error(err.message || 'Failed to fetch purchase logs');
    } finally {
      setLoading(false);
    }
  };

  const fetchDependencies = async () => {
    try {
      const [suppliersRes, productsRes, plantsRes] = await Promise.all([
        api.get('/suppliers?limit=100'),
        api.get('/products?limit=100'),
        api.get('/plants?limit=100')
      ]);
      if (suppliersRes.success) setSuppliers(suppliersRes.data || []);
      if (productsRes.success) setProducts(productsRes.data || []);
      if (plantsRes.success) setPlants(plantsRes.data || []);
    } catch (err) {
      console.error('Failed to load form dependencies:', err);
    }
  };

  useEffect(() => {
    fetchPurchases(1);
    fetchDependencies();
  }, []);

  const handleTableChange = (pag) => {
    fetchPurchases(pag.current, filterPlant);
  };

  const handlePlantFilterChange = (val) => {
    setFilterPlant(val);
    fetchPurchases(1, val);
  };

  const handleProductSelect = (productId, fieldIndex) => {
    const selected = products.find(p => p._id === productId);
    if (selected) {
      const items = form.getFieldValue('items') || [];
      items[fieldIndex] = {
        ...items[fieldIndex],
        purchasePrice: selected.purchasePrice
      };
      form.setFieldsValue({ items });
    }
  };

  const handleOpenForm = () => {
    form.resetFields();
    form.setFieldsValue({
      purchaseDate: dayjs(),
      items: [{ productId: '', quantity: 1, purchasePrice: 0, allocations: [{ plantId: '', quantity: 1 }] }]
    });
    setIsFormOpen(true);
  };

  const handleSubmit = async (values) => {
    // Frontend Allocations Validations
    for (let i = 0; i < values.items.length; i++) {
      const item = values.items[i];
      const allocTotal = (item.allocations || []).reduce((sum, a) => sum + (a.quantity || 0), 0);
      if (allocTotal !== item.quantity) {
        const prod = products.find(p => p._id === item.productId);
        return message.error(
          `Validation Failed: Allocation sum (${allocTotal}) must equal purchased quantity (${item.quantity}) for product: ${prod ? prod.productName : `Item ${i + 1}`}.`
        );
      }
    }

    try {
      const payload = {
        supplierId: values.supplierId,
        invoiceNumber: values.invoiceNumber,
        purchaseDate: values.purchaseDate ? values.purchaseDate.toDate() : new Date(),
        items: values.items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          purchasePrice: item.purchasePrice,
          allocations: item.allocations.map(a => ({
            plantId: a.plantId,
            quantity: a.quantity
          }))
        }))
      };

      const res = await api.post('/purchases', payload);
      if (res.success) {
        message.success('Bifurcated purchase entry saved! Stock logs updated.');
        form.resetFields();
        setIsFormOpen(false);
        fetchPurchases(1, filterPlant);
      }
    } catch (err) {
      message.error(err.message || 'Failed to record purchase entry');
    }
  };

  const columns = [
    {
      title: 'Purchase Date',
      dataIndex: 'purchaseDate',
      key: 'purchaseDate',
      render: (date) => new Date(date).toLocaleDateString()
    },
    {
      title: 'Invoice Number',
      dataIndex: 'invoiceNumber',
      key: 'invoiceNumber',
      render: (text) => <Tag color="blue" style={{ fontWeight: 600 }}>{text}</Tag>
    },
    {
      title: 'Supplier',
      dataIndex: ['supplierId', 'supplierName'],
      key: 'supplierName',
      render: (text) => <b>{text}</b>
    },
    {
      title: 'Total Items',
      key: 'totalItems',
      align: 'center',
      render: (_, record) => (record.items || []).length
    },
    {
      title: 'Total Outflow (₹)',
      key: 'totalOutflow',
      align: 'right',
      render: (_, record) => {
        const sum = (record.items || []).reduce((acc, item) => acc + (item.quantity * item.purchasePrice), 0);
        return <b>₹{sum.toLocaleString()}</b>;
      }
    },
    {
      title: 'Logged By',
      dataIndex: ['createdBy', 'name'],
      key: 'createdBy'
    }
  ];

  // Expanded Row Render for purchase details and bifurcation allocations
  const expandedRowRender = (record) => {
    const itemColumns = [
      {
        title: 'Product',
        dataIndex: ['productId', 'productName'],
        key: 'productName',
        render: (name, item) => <b>{name} ({item.productId?.productCode})</b>
      },
      {
        title: 'Total Qty',
        dataIndex: 'quantity',
        key: 'quantity',
        align: 'right'
      },
      {
        title: 'Purchase Price (₹)',
        dataIndex: 'purchasePrice',
        key: 'purchasePrice',
        align: 'right',
        render: (val) => val.toFixed(2)
      },
      {
        title: 'Line Subtotal (₹)',
        key: 'subtotal',
        align: 'right',
        render: (_, item) => (item.quantity * item.purchasePrice).toFixed(2)
      },
      {
        title: 'Plant Bifurcation Allocations',
        key: 'allocations',
        render: (_, item) => (
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            {(item.allocations || []).map((alloc, idx) => (
              <Tag color="cyan" key={idx}>
                {alloc.plantId?.plantName} ({alloc.plantId?.plantCode}): <b>{alloc.quantity}</b> Units
              </Tag>
            ))}
          </Space>
        )
      }
    ];

    return (
      <Table
        columns={itemColumns}
        dataSource={record.items.map((item, idx) => ({ ...item, key: idx }))}
        pagination={false}
        bordered
        size="small"
      />
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {canRecord && (
        <Card 
          title="Stock In: Record Purchase Entry with Plant Allocation"
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
                  name="supplierId"
                  label="Select Supplier / Vendor"
                  rules={[{ required: true, message: 'Please select a supplier!' }]}
                >
                  <Select placeholder="Search and select vendor" showSearch optionFilterProp="children">
                    {suppliers.map(s => (
                      <Option key={s._id} value={s._id}>{s.supplierName}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item
                  name="invoiceNumber"
                  label="Vendor Purchase Invoice No."
                  rules={[{ required: true, message: 'Please enter invoice number!' }]}
                >
                  <Input placeholder="e.g. APEX/2026-27/8921" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item
                  name="purchaseDate"
                  label="Purchase / Booking Date"
                  rules={[{ required: true, message: 'Please select date!' }]}
                >
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>

            <Divider style={{ margin: '12px 0' }} />

            {/* Form List of Items */}
            <Form.List name="items">
              {(fields, { add, remove }) => (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {fields.map(({ key, name, ...restField }, index) => (
                    <Card 
                      size="small" 
                      title={`Purchased Product Line #${index + 1}`} 
                      key={key} 
                      style={{ border: '1px solid #d9d9d9', borderRadius: '6px' }}
                      extra={
                        fields.length > 1 && (
                          <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(name)} />
                        )
                      }
                    >
                      <Row gutter={16}>
                        <Col xs={24} sm={10}>
                          <Form.Item
                            {...restField}
                            name={[name, 'productId']}
                            label="Product Master"
                            rules={[{ required: true, message: 'Select product' }]}
                          >
                            <Select 
                              placeholder="Search and select product" 
                              showSearch 
                              optionFilterProp="children"
                              onChange={(val) => handleProductSelect(val, name)}
                            >
                              {products.map(p => (
                                <Option key={p._id} value={p._id}>{p.productName} ({p.productCode})</Option>
                              ))}
                            </Select>
                          </Form.Item>
                        </Col>
                        <Col xs={24} sm={7}>
                          <Form.Item
                            {...restField}
                            name={[name, 'quantity']}
                            label="Total Qty Purchased"
                            rules={[{ required: true, message: 'Enter qty' }]}
                          >
                            <InputNumber min={1} style={{ width: '100%' }} placeholder="Purchased quantity count..." />
                          </Form.Item>
                        </Col>
                        <Col xs={24} sm={7}>
                          <Form.Item
                            {...restField}
                            name={[name, 'purchasePrice']}
                            label="Purchase Rate (INR)"
                            rules={[{ required: true, message: 'Enter rate' }]}
                          >
                            <InputNumber min={0} style={{ width: '100%' }} placeholder="Rate per unit..." />
                          </Form.Item>
                        </Col>
                      </Row>

                      {/* Plant Allocations Section */}
                      <div style={{ padding: '8px 16px', backgroundColor: '#fafafa', borderRadius: '4px', borderLeft: '3px solid #1890ff' }}>
                        <span style={{ fontWeight: 500, fontSize: '12px', display: 'block', marginBottom: '8px' }}>
                          Plant-wise Allocation Bifurcation:
                        </span>

                        <Form.List name={[name, 'allocations']}>
                          {(allocFields, { add: addAlloc, remove: removeAlloc }) => (
                            <div>
                              {allocFields.map((allocField, aIdx) => (
                                <Row key={allocField.key} gutter={12} align="middle" style={{ marginBottom: '8px' }}>
                                  <Col span={12}>
                                    <Form.Item
                                      {...allocField}
                                      name={[allocField.name, 'plantId']}
                                      rules={[{ required: true, message: 'Select plant' }]}
                                      noStyle
                                    >
                                      <Select placeholder="Target Plant Location" style={{ width: '100%' }}>
                                        {plants.map(pl => (
                                          <Option key={pl._id} value={pl._id}>{pl.plantName} ({pl.plantCode})</Option>
                                        ))}
                                      </Select>
                                    </Form.Item>
                                  </Col>
                                  <Col span={8}>
                                    <Form.Item
                                      {...allocField}
                                      name={[allocField.name, 'quantity']}
                                      rules={[{ required: true, message: 'Enter allocated qty' }]}
                                      noStyle
                                    >
                                      <InputNumber min={1} style={{ width: '100%' }} placeholder="Quantity" />
                                    </Form.Item>
                                  </Col>
                                  <Col span={4}>
                                    <Button 
                                      type="text" 
                                      danger 
                                      icon={<DeleteOutlined />} 
                                      onClick={() => removeAlloc(allocField.name)}
                                      disabled={allocFields.length === 1} 
                                    />
                                  </Col>
                                </Row>
                              ))}
                              <Button 
                                type="dashed" 
                                size="small"
                                onClick={() => addAlloc({ plantId: '', quantity: 1 })} 
                                icon={<PlusCircleOutlined />}
                                style={{ marginTop: '4px' }}
                              >
                                Add Plant Allocation Allocation Line
                              </Button>
                            </div>
                          )}
                        </Form.List>
                      </div>
                    </Card>
                  ))}
                  <Button type="dashed" onClick={() => add({ productId: '', quantity: 1, purchasePrice: 0, allocations: [{ plantId: '', quantity: 1 }] })} icon={<PlusOutlined />} style={{ width: '100%' }}>
                    Add Product Invoice Line Item
                  </Button>
                </div>
              )}
            </Form.List>

            <Form.Item style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 0, marginTop: '24px' }}>
              <Space>
                <Button onClick={() => setIsFormOpen(false)}>Cancel</Button>
                <Button type="primary" htmlType="submit">Save bifurcated Purchase</Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>
      )}

      <Card 
        title={
          <span>
            <HistoryOutlined /> Purchase Ledger & History
          </span>
        }
        extra={
          <Space>
            <Select
              allowClear
              placeholder="Filter by Plant"
              style={{ width: 180 }}
              value={filterPlant}
              onChange={handlePlantFilterChange}
            >
              {plants.map(p => (
                <Option key={p._id} value={p._id}>{p.plantName}</Option>
              ))}
            </Select>
            {canRecord && !isFormOpen && (
              <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenForm}>
                Record Purchase
              </Button>
            )}
          </Space>
        }
      >
        <Table
          dataSource={purchases}
          columns={columns}
          rowKey="_id"
          loading={loading}
          pagination={pagination}
          onChange={handleTableChange}
          expandable={{ expandedRowRender }}
          bordered
        />
      </Card>
    </div>
  );
};

export default Purchases;
