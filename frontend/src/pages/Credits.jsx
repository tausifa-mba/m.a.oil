import React, { useState, useEffect } from 'react';
import { 
  Table, Card, Button, Input, Modal, Form, Row, Col, Select, 
  InputNumber, Radio, Divider, Space, Alert, Tag, DatePicker, message, Typography
} from 'antd';
import { 
  PlusOutlined, SearchOutlined, EyeOutlined, DeleteOutlined, WalletOutlined 
} from '@ant-design/icons';
import api from '../services/api';
import dayjs from 'dayjs';

const { Option } = Select;
const { Title } = Typography;

const Credits = () => {
  const [loading, setLoading] = useState(false);
  const [credits, setCredits] = useState([]);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Form states
  const [createForm] = Form.useForm();
  const [dispatchType, setDispatchType] = useState('Single');
  const [sourcePlant, setSourcePlant] = useState(null);
  const [orderItems, setOrderItems] = useState([{ productId: '', quantity: 1, rate: 0, amount: 0, availStock: 0, dispatches: [] }]);

  // Dependency states
  const [customers, setCustomers] = useState([]);
  const [plants, setPlants] = useState([]);
  const [products, setProducts] = useState([]);
  const [companySettings, setCompanySettings] = useState(null);

  const fetchCredits = async (page = 1, searchQuery = '') => {
    setLoading(true);
    try {
      const res = await api.get(`/credits?page=${page}&limit=${pagination.pageSize}&search=${searchQuery}`);
      if (res.success) {
        setCredits(res.data || []);
        setPagination({
          ...pagination,
          current: res.page,
          total: res.total
        });
      }
    } catch (err) {
      message.error(err.message || 'Failed to fetch credit orders');
    } finally {
      setLoading(false);
    }
  };

  const fetchDependencies = async () => {
    try {
      const [customersRes, plantsRes, productsRes, settingsRes] = await Promise.all([
        api.get('/customers?limit=100'),
        api.get('/plants?limit=100'),
        api.get('/products?limit=100'),
        api.get('/settings')
      ]);
      if (customersRes.success) setCustomers(customersRes.data || []);
      if (plantsRes.success) setPlants(plantsRes.data || []);
      if (productsRes.success) setProducts(productsRes.data || []);
      if (settingsRes.success) setCompanySettings(settingsRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchCredits(1);
    fetchDependencies();
  }, []);

  const handleTableChange = (pag) => {
    fetchCredits(pag.current, search);
  };

  const handleSearch = (val) => {
    setSearch(val);
    fetchCredits(1, val);
  };

  const handleOpenCreate = () => {
    setDispatchType('Single');
    setSourcePlant(null);
    setOrderItems([{ productId: '', quantity: 1, rate: 0, amount: 0, availStock: 0, dispatches: [] }]);
    createForm.resetFields();
    createForm.setFieldsValue({
      orderDate: dayjs(),
      dispatchType: 'Single'
    });
    setIsCreateOpen(true);
  };

  const handleSourcePlantChange = async (plantId) => {
    setSourcePlant(plantId);
    // Reload stocks for all selected products
    const updated = await Promise.all(orderItems.map(async (item) => {
      if (item.productId) {
        try {
          const res = await api.get(`/plants/${plantId}/inventory`);
          const inv = (res.data || []).find(i => i.productId?._id === item.productId);
          return {
            ...item,
            availStock: inv ? inv.availableQuantity : 0
          };
        } catch {
          return item;
        }
      }
      return item;
    }));
    setOrderItems(updated);
  };

  const handleItemChange = async (index, field, value) => {
    const updated = [...orderItems];
    updated[index][field] = value;

    if (field === 'productId') {
      const prod = products.find(p => p._id === value);
      // Pre-fill default rate if it exists, though user can edit dynamically
      updated[index].rate = prod ? (prod.sellingPrice || 0) : 0;
      
      // Load stock levels if single plant is selected
      if (dispatchType === 'Single' && sourcePlant) {
        try {
          const res = await api.get(`/plants/${sourcePlant}/inventory`);
          const inv = (res.data || []).find(i => i.productId?._id === value);
          updated[index].availStock = inv ? inv.availableQuantity : 0;
        } catch {
          updated[index].availStock = 0;
        }
      } else {
        updated[index].availStock = 0;
      }

      // Initialize dispatches splits
      updated[index].dispatches = [];
    }

    updated[index].amount = updated[index].quantity * updated[index].rate;
    setOrderItems(updated);
  };

  const addItemRow = () => {
    setOrderItems([
      ...orderItems,
      { productId: '', quantity: 1, rate: 0, amount: 0, availStock: 0, dispatches: [] }
    ]);
  };

  const removeItemRow = (index) => {
    const updated = orderItems.filter((_, idx) => idx !== index);
    setOrderItems(updated);
  };

  const handleDispatchChange = (itemIdx, dispIdx, field, value) => {
    const updated = [...orderItems];
    const item = updated[itemIdx];
    
    if (!item.dispatches[dispIdx]) {
      item.dispatches[dispIdx] = { plantId: '', quantity: 0 };
    }
    item.dispatches[dispIdx][field] = value;
    setOrderItems(updated);
  };

  const addDispatchRow = (itemIdx) => {
    const updated = [...orderItems];
    updated[itemIdx].dispatches.push({ plantId: '', quantity: 0 });
    setOrderItems(updated);
  };

  const removeDispatchRow = (itemIdx, dispIdx) => {
    const updated = [...orderItems];
    updated[itemIdx].dispatches = updated[itemIdx].dispatches.filter((_, idx) => idx !== dispIdx);
    setOrderItems(updated);
  };

  // Compute live subtotal
  const subtotal = orderItems.reduce((sum, item) => sum + (item.amount || 0), 0);

  const handleCreateSubmit = async (values) => {
    try {
      // Validate items
      const payloadItems = orderItems.map(item => {
        if (!item.productId) throw new Error('Please select a product for all lines.');
        if (item.quantity <= 0) throw new Error('Quantity must be greater than 0.');
        if (item.rate < 0) throw new Error('Rate cannot be negative.');

        const returnItem = {
          productId: item.productId,
          quantity: item.quantity,
          rate: item.rate
        };

        if (dispatchType === 'Multi') {
          if (!item.dispatches || item.dispatches.length === 0) {
            throw new Error('Please define dispatch warehouse splits in multi-plant mode.');
          }
          const sumSplits = item.dispatches.reduce((sum, d) => sum + (d.quantity || 0), 0);
          if (sumSplits !== item.quantity) {
            throw new Error(`Dispatch split total (${sumSplits}) does not match total ordered quantity (${item.quantity}) for product.`);
          }
          returnItem.dispatches = item.dispatches;
        }

        return returnItem;
      });

      const payload = {
        ...values,
        dispatchType,
        items: payloadItems
      };

      const res = await api.post('/credits', payload);
      if (res.success) {
        message.success('Credit order recorded successfully');
        setIsCreateOpen(false);
        fetchCredits(1);
      }
    } catch (err) {
      message.error(err.message || 'Failed to submit credit order');
    }
  };

  const openOrderDetails = async (record) => {
    try {
      const res = await api.get(`/credits/${record._id}`);
      if (res.success) {
        setSelectedOrder(res.data);
        setIsDetailOpen(true);
      }
    } catch (err) {
      message.error(err.message || 'Failed to fetch credit order details');
    }
  };

  const formatDateStr = (d) => {
    if (!d) return 'N/A';
    const date = new Date(d);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${date.getDate()}-${months[date.getMonth()]}-${String(date.getFullYear()).slice(-2)}`;
  };

  const columns = [
    {
      title: 'Order No',
      dataIndex: 'orderNumber',
      key: 'orderNumber',
      render: (text) => <b>{text}</b>
    },
    {
      title: 'Date',
      dataIndex: 'orderDate',
      key: 'orderDate',
      render: (val) => formatDateStr(val)
    },
    {
      title: 'Customer',
      dataIndex: ['customer', 'customerName'],
      key: 'customer'
    },
    {
      title: 'Dispatch Mode',
      dataIndex: 'dispatchType',
      key: 'dispatchType',
      render: (val) => <Tag color={val === 'Multi' ? 'purple' : 'blue'}>{val} Plant</Tag>
    },
    {
      title: 'Total Amount (₹)',
      dataIndex: 'grandTotal',
      key: 'grandTotal',
      align: 'right',
      render: (val) => <b>{Number(val).toFixed(2)}</b>
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Button 
          type="text" 
          icon={<EyeOutlined style={{ color: '#0d47a1' }} />} 
          onClick={() => openOrderDetails(record)}
        >
          View details
        </Button>
      )
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <Card 
        title={
          <Title level={4} style={{ margin: 0, color: '#0d47a1', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <WalletOutlined /> Credit Orders & Sales Management
          </Title>
        }
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate} style={{ backgroundColor: '#2e7d32', borderColor: '#2e7d32' }}>
            Record Credit Sale
          </Button>
        }
        style={{ borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}
      >
        <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', maxWidth: '350px' }}>
          <Input
            placeholder="Search Order Number..."
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
          dataSource={credits}
          columns={columns}
          rowKey="_id"
          loading={loading}
          pagination={pagination}
          onChange={handleTableChange}
          bordered
        />
      </Card>

      {/* RECORD CREDIT SALE MODAL */}
      <Modal
        title="Record Credit Sale Order"
        open={isCreateOpen}
        onCancel={() => setIsCreateOpen(false)}
        width={900}
        footer={null}
        destroyOnClose
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={handleCreateSubmit}
          style={{ marginTop: '16px' }}
        >
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="customer"
                label="Customer / Client (Credit Buyer)"
                rules={[{ required: true, message: 'Please select a customer!' }]}
              >
                <Select placeholder="Select customer..." showSearch optionFilterProp="children">
                  {customers.map(c => (
                    <Option key={c._id} value={c._id}>{c.customerName}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="dispatchType" label="Dispatch Mode">
                <Radio.Group onChange={(e) => setDispatchType(e.target.value)} value={dispatchType}>
                  <Radio.Button value="Single">Single Plant</Radio.Button>
                  <Radio.Button value="Multi">Multi Plant</Radio.Button>
                </Radio.Group>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="orderDate" label="Credit Order Date">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          {dispatchType === 'Single' && (
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="sourcePlantId"
                  label="Dispatch Warehouse plant (Stock Out Location)"
                  rules={[{ required: true, message: 'Please select dispatch plant!' }]}
                >
                  <Select placeholder="Dispatch stock from..." onChange={handleSourcePlantChange}>
                    {plants.map(p => (
                      <Option key={p._id} value={p._id}>{p.plantName} ({p.plantCode})</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>
          )}

          <Divider orientation="left" style={{ margin: '12px 0' }}>Logistics & Dispatch Details</Divider>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item name="referenceNumber" label="Reference Number">
                <Input placeholder="e.g. REF-CREDIT" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="buyerOrderNumber" label="PO Number">
                <Input placeholder="e.g. PO-7788" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="dispatchNumber" label="Dispatch Number">
                <Input placeholder="e.g. CH-8899" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="vehicleNumber" label="Vehicle Number">
                <Input placeholder="e.g. JH05H7788" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="dispatchThrough" label="Dispatch Through">
                <Input placeholder="e.g. Transport Corp" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="destination" label="Destination">
                <Input placeholder="e.g. Jamshedpur" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="termsOfDelivery" label="Terms of Delivery">
                <Input placeholder="e.g. To Be Billed" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" style={{ margin: '12px 0' }}>Credit Order Products</Divider>

          {dispatchType === 'Single' && !sourcePlant ? (
            <Alert message="Please select a dispatch warehouse plant before adding product lines." type="warning" showIcon />
          ) : (
            <div>
              {orderItems.map((item, index) => (
                <Card 
                  size="small" 
                  key={index} 
                  style={{ marginBottom: '12px', border: '1px solid #e8e8e8', borderRadius: '6px' }}
                  extra={
                    orderItems.length > 1 && (
                      <Button type="text" danger icon={<DeleteOutlined />} onClick={() => removeItemRow(index)} />
                    )
                  }
                  title={`Product Line Item #${index + 1}`}
                >
                  <Row gutter={12} align="middle">
                    <Col span={10}>
                      <Form.Item label="Select Product" required>
                        <Select
                          placeholder="Select Product"
                          value={item.productId || undefined}
                          onChange={(val) => handleItemChange(index, 'productId', val)}
                          showSearch
                          optionFilterProp="children"
                          style={{ width: '100%' }}
                        >
                          {products.map(p => (
                            <Option key={p._id} value={p._id}>{p.productName}</Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={5}>
                      <Form.Item label="Quantity" required>
                        <InputNumber
                          min={1}
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(val) => handleItemChange(index, 'quantity', val)}
                          style={{ width: '100%' }}
                        />
                        {dispatchType === 'Single' && (
                          <div style={{ fontSize: '10px', color: '#999', marginTop: '2px' }}>
                            Avail Stock: {item.availStock}
                          </div>
                        )}
                      </Form.Item>
                    </Col>
                    <Col span={5}>
                      <Form.Item label="Dynamic Unit Rate (₹)" required>
                        <InputNumber
                          min={0}
                          placeholder="Rate"
                          value={item.rate}
                          onChange={(val) => handleItemChange(index, 'rate', val)}
                          style={{ width: '100%' }}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={4}>
                      <Form.Item label="Total Amount">
                        <Input
                          value={`₹${(item.amount || 0).toFixed(2)}`}
                          disabled
                          style={{ width: '100%', fontWeight: '500' }}
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  {/* Multi plant dispatches nested section */}
                  {dispatchType === 'Multi' && item.productId && (
                    <div style={{ marginTop: '8px', padding: '10px', backgroundColor: '#fafafa', borderRadius: '4px' }}>
                      <span style={{ fontWeight: 500, fontSize: '12px', display: 'block', marginBottom: '8px' }}>
                        Multi-Plant Dispatch Splits:
                      </span>
                      {item.dispatches.map((disp, dIdx) => (
                        <Row key={dIdx} gutter={12} align="middle" style={{ marginBottom: '8px' }}>
                          <Col span={10}>
                            <Select 
                              placeholder="Dispatch Plant" 
                              value={disp.plantId || undefined}
                              onChange={(val) => handleDispatchChange(index, dIdx, 'plantId', val)}
                              style={{ width: '100%' }}
                            >
                              {plants.map(p => (
                                <Option key={p._id} value={p._id}>{p.plantName} ({p.plantCode})</Option>
                              ))}
                            </Select>
                          </Col>
                          <Col span={10}>
                            <InputNumber 
                              min={1} 
                              placeholder="Quantity" 
                              value={disp.quantity || undefined}
                              onChange={(val) => handleDispatchChange(index, dIdx, 'quantity', val)}
                              style={{ width: '100%' }}
                            />
                          </Col>
                          <Col span={4}>
                            <Button type="text" danger icon={<DeleteOutlined />} onClick={() => removeDispatchRow(index, dIdx)} />
                          </Col>
                        </Row>
                      ))}
                      <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={() => addDispatchRow(index)}>
                        Add Dispatch Warehouse Allocation
                      </Button>
                    </div>
                  )}
                </Card>
              ))}
              <Button type="dashed" onClick={addItemRow} style={{ width: '100%', marginBottom: '16px' }} icon={<PlusOutlined />}>
                Add Product Line Item
              </Button>
            </div>
          )}

          <Row gutter={16} justify="end" style={{ marginTop: '16px' }}>
            <Col span={8}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', border: '1px solid #f0f2f5', padding: '16px', borderRadius: '6px', backgroundColor: '#fafafa' }}>
                <div style={{ display: 'flex', justify: 'space-between' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '15px' }}>Grand Total (INR):</span>
                  <span style={{ fontWeight: 'bold', fontSize: '15px', color: '#2e7d32' }}>₹{subtotal.toFixed(2)}</span>
                </div>
              </div>
            </Col>
          </Row>

          <Form.Item name="notes" label="Credit Order Notes" style={{ marginTop: '16px' }}>
            <Input.TextArea placeholder="Internal remarks regarding credit sale..." />
          </Form.Item>

          <Form.Item style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 0, marginTop: '20px' }}>
            <Space>
              <Button onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" style={{ backgroundColor: '#2e7d32', borderColor: '#2e7d32' }}>
                Generate Credit Order
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* DETAIL MODAL */}
      <Modal
        title="Credit Order details"
        open={isDetailOpen}
        onCancel={() => setIsDetailOpen(false)}
        width={750}
        footer={[
          <Button key="close" onClick={() => setIsDetailOpen(false)}>Close</Button>
        ]}
      >
        {selectedOrder && (
          <div style={{
            fontFamily: 'Helvetica, Arial, sans-serif',
            fontSize: '11px',
            color: '#000000',
            lineHeight: '1.3',
            border: '1.5px solid #000000',
            padding: '0',
            backgroundColor: '#ffffff',
            boxSizing: 'border-box'
          }}>
            <div style={{
              textAlign: 'center',
              fontWeight: 'bold',
              fontSize: '13px',
              borderBottom: '1.2px solid #000000',
              padding: '4px 0',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              backgroundColor: '#f5f5f5'
            }}>
              Credit Order Note
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '50% 50%', width: '100%' }}>
              <div style={{ borderRight: '1.2px solid #000000', padding: '8px' }}>
                <div style={{ fontWeight: 'bold', fontSize: '12px' }}>{companySettings?.companyName || 'M.A. OIL'}</div>
                <div>{companySettings?.address || 'Purani Basti Road Jugsalai, Jamshedpur'}</div>
                <div style={{ marginTop: '4px' }}>GSTIN/UIN: {companySettings?.gstin || '20AGLPM2087Q1ZY'}</div>
                <div>State Name: {companySettings?.stateName || 'Jharkhand'}, Code: {companySettings?.stateCode || '20'}</div>
              </div>
              <div style={{ padding: '8px' }}>
                <div>Order Number: <strong>{selectedOrder.orderNumber}</strong></div>
                <div>Order Date: <strong>{formatDateStr(selectedOrder.orderDate)}</strong></div>
                <div>PO Reference: {selectedOrder.buyerOrderNumber || 'N/A'}</div>
                <div>Vehicle Number: {selectedOrder.vehicleNumber || 'N/A'}</div>
              </div>
            </div>

            <Divider style={{ margin: 0, borderColor: '#000000' }} />

            <div style={{ padding: '8px', borderBottom: '1.2px solid #000000' }}>
              <div style={{ fontWeight: 'bold', color: '#555', fontSize: '9px' }}>Buyer (Credit to):</div>
              <div style={{ fontWeight: 'bold', fontSize: '11px', marginTop: '2px' }}>{selectedOrder.customer?.customerName}</div>
              <div>{selectedOrder.customer?.address || 'N/A'}, {selectedOrder.customer?.city || 'N/A'}</div>
              <div>GSTIN/UIN: {selectedOrder.customer?.gstNumber || 'N/A'}</div>
              <div>State Name: {selectedOrder.customer?.state || 'N/A'}</div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', borderBottom: '1.2px solid #000000' }}>
              <thead>
                <tr style={{ borderBottom: '1.2px solid #000000', fontWeight: 'bold', fontSize: '10px', backgroundColor: '#f5f5f5' }}>
                  <th style={{ padding: '6px', borderRight: '1.2px solid #000000', width: '8%', textAlign: 'center' }}>Sl No.</th>
                  <th style={{ padding: '6px', borderRight: '1.2px solid #000000', width: '52%', textAlign: 'left' }}>Description of Goods</th>
                  <th style={{ padding: '6px', borderRight: '1.2px solid #000000', width: '15%', textAlign: 'right' }}>Quantity</th>
                  <th style={{ padding: '6px', borderRight: '1.2px solid #000000', width: '12%', textAlign: 'right' }}>Rate (₹)</th>
                  <th style={{ padding: '6px', textAlign: 'right', width: '13%' }}>Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {(selectedOrder.products || []).map((item, idx) => (
                  <tr key={idx} style={{ verticalAlign: 'top', fontSize: '10px' }}>
                    <td style={{ padding: '6px', borderRight: '1.2px solid #000000', textAlign: 'center' }}>{idx + 1}</td>
                    <td style={{ padding: '6px', borderRight: '1.2px solid #000000' }}>
                      <div style={{ fontWeight: 'bold' }}>{item.productId?.productName}</div>
                      <div style={{ fontSize: '8px', color: '#666' }}>Specs: {item.productId?.capacity} | {item.productId?.materialType}</div>
                      {selectedOrder.dispatchType === 'Multi' && (
                        <div style={{ fontSize: '8px', color: '#2e7d32', marginTop: '3px' }}>
                          Warehouse Splits: {(item.dispatches || []).map(d => `${d.plantId?.plantCode}: ${d.quantity}`).join(', ')}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '6px', borderRight: '1.2px solid #000000', textAlign: 'right', fontWeight: 'bold' }}>
                      {item.quantity} {item.productId?.unit || 'Nos'}
                    </td>
                    <td style={{ padding: '6px', borderRight: '1.2px solid #000000', textAlign: 'right' }}>
                      {Number(item.rate).toFixed(2)}
                    </td>
                    <td style={{ padding: '6px', textAlign: 'right', fontWeight: 'bold' }}>
                      {Number(item.amount).toFixed(2)}
                    </td>
                  </tr>
                ))}
                
                {/* Empty spaces to align total at bottom */}
                <tr style={{ height: '40px' }}>
                  <td style={{ borderRight: '1.2px solid #000000' }}></td>
                  <td style={{ borderRight: '1.2px solid #000000' }}></td>
                  <td style={{ borderRight: '1.2px solid #000000' }}></td>
                  <td style={{ borderRight: '1.2px solid #000000' }}></td>
                  <td></td>
                </tr>

                <tr style={{ borderTop: '1.2px solid #000000', fontWeight: 'bold', backgroundColor: '#f5f5f5' }}>
                  <td style={{ borderRight: '1.2px solid #000000' }}></td>
                  <td style={{ padding: '6px', borderRight: '1.2px solid #000000', textAlign: 'center' }}>Total</td>
                  <td style={{ padding: '6px', borderRight: '1.2px solid #000000', textAlign: 'right' }}>
                    {selectedOrder.products.reduce((s, p) => s + p.quantity, 0)} {selectedOrder.products[0]?.productId?.unit || 'Nos'}
                  </td>
                  <td style={{ borderRight: '1.2px solid #000000' }}></td>
                  <td style={{ padding: '6px', textAlign: 'right' }}>{Number(selectedOrder.grandTotal).toFixed(2)}</td>
                </tr>
              </tbody>
            </table>

            {selectedOrder.notes && (
              <div style={{ padding: '8px', fontSize: '9px', fontStyle: 'italic', borderBottom: '1px solid #000000' }}>
                <strong>Remarks:</strong> {selectedOrder.notes}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '60% 40%', width: '100%' }}>
              <div style={{ padding: '8px', borderRight: '1.2px solid #000000', fontSize: '8px', color: '#555' }}>
                Note: This is an internal ledger credit document. Stock inventory levels have been adjusted dynamically from selected warehouses upon generating this order.
              </div>
              <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', minHeight: '60px', justifyContent: 'space-between' }}>
                <div style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '8px' }}>for {companySettings?.companyName || 'M.A. OIL'}</div>
                <div style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '9px' }}>Authorized Representative</div>
              </div>
            </div>

          </div>
        )}
      </Modal>
    </div>
  );
};

export default Credits;
