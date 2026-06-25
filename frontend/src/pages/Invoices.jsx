import React, { useState, useEffect, useRef } from 'react';
import { Table, Card, Button, Form, Select, InputNumber, DatePicker, message, Row, Col, Divider, Space, Modal, Input, Tag, Alert, Radio } from 'antd';
import { PlusOutlined, SearchOutlined, EyeOutlined, FilePdfOutlined, PlusCircleOutlined, DeleteOutlined, PrinterOutlined } from '@ant-design/icons';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const { Option } = Select;

const Invoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [plants, setPlants] = useState([]);
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [search, setSearch] = useState('');
  
  // Creation States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [dispatchType, setDispatchType] = useState('Single');
  const [sourcePlant, setSourcePlant] = useState(null);
  const [invoiceItems, setInvoiceItems] = useState([
    { 
      productId: '', 
      quantity: 1, 
      rate: 0, 
      amount: 0, 
      availStock: 0, 
      dispatches: [{ plantId: '', quantity: 1, availStock: 0 }] 
    }
  ]);
  const [createForm] = Form.useForm();
  
  // Detail Modal States
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const printCanvasRef = useRef(null);

  const { user } = useAuth();
  
  // Watch the selected gstType to render dynamic GST summary on screen
  const selectedGstType = Form.useWatch('gstType', createForm) || 'CGST';

  const handleCustomerChange = (customerId) => {
    const cust = customers.find(c => c._id === customerId);
    if (cust) {
      createForm.setFieldsValue({
        buyerName: cust.customerName || '',
        buyerAddress: cust.address || '',
        buyerGSTIN: cust.gstNumber || '',
        buyerState: cust.state || '',
        buyerStateCode: cust.gstNumber ? cust.gstNumber.slice(0, 2) : '',
      });
      // Auto-detect local vs interstate GST type based on buyer state
      const isLocalState = (cust.state || '').toLowerCase().trim() === 'jharkhand';
      createForm.setFieldsValue({
        gstType: isLocalState ? 'CGST' : 'IGST'
      });
    }
  };

  const fetchInvoices = async (page = 1, searchQuery = '') => {
    setLoading(true);
    try {
      const res = await api.get(`/invoices?page=${page}&limit=${pagination.pageSize}&search=${searchQuery}`);
      if (res.success) {
        setInvoices(res.data || []);
        setPagination({
          ...pagination,
          current: res.page,
          total: res.total
        });
      }
    } catch (err) {
      message.error(err.message || 'Failed to fetch invoices');
    } finally {
      setLoading(false);
    }
  };

  const fetchDependencies = async () => {
    try {
      const [customersRes, plantsRes, productsRes] = await Promise.all([
        api.get('/customers?limit=100'),
        api.get('/plants?limit=100'),
        api.get('/products?limit=100')
      ]);
      if (customersRes.success) setCustomers(customersRes.data || []);
      if (plantsRes.success) setPlants(plantsRes.data || []);
      if (productsRes.success) setProducts(productsRes.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchInvoices(1);
    fetchDependencies();
  }, []);

  const handleTableChange = (pag) => {
    fetchInvoices(pag.current, search);
  };

  const handleSearch = (val) => {
    setSearch(val);
    fetchInvoices(1, val);
  };

  // Creation Actions
  const handleOpenCreate = () => {
    setDispatchType('Single');
    setSourcePlant(null);
    setInvoiceItems([
      { 
        productId: '', 
        quantity: 1, 
        rate: 0, 
        amount: 0, 
        availStock: 0, 
        dispatches: [{ plantId: '', quantity: 1, availStock: 0 }] 
      }
    ]);
    createForm.resetFields();
    createForm.setFieldsValue({ dispatchType: 'Single', gstType: 'CGST' });
    setIsCreateOpen(true);
  };

  const handleSourcePlantChange = async (plantId) => {
    setSourcePlant(plantId);
    
    // Refresh available stock for all items using this source plant
    const updated = [...invoiceItems];
    for (let i = 0; i < updated.length; i++) {
      const item = updated[i];
      if (item.productId) {
        try {
          const res = await api.get(`/products/${item.productId}/inventory`);
          if (res.success) {
            const match = (res.stock || []).find(s => s.plantId?._id === plantId);
            updated[i].availStock = match ? match.availableQuantity : 0;
          }
        } catch (err) {
          console.error(err);
        }
      }
    }
    setInvoiceItems(updated);
  };

  const handleItemChange = async (index, field, value) => {
    const updated = [...invoiceItems];
    updated[index][field] = value;

    if (field === 'productId') {
      const selected = products.find(p => p._id === value);
      if (selected) {
        updated[index].rate = selected.sellingPrice;
        updated[index].amount = updated[index].quantity * selected.sellingPrice;
        
        // Fetch stock level if Single Plant is active
        if (dispatchType === 'Single' && sourcePlant) {
          try {
            const res = await api.get(`/products/${value}/inventory`);
            if (res.success) {
              const match = (res.stock || []).find(s => s.plantId?._id === sourcePlant);
              updated[index].availStock = match ? match.availableQuantity : 0;
            }
          } catch (err) {
            console.error(err);
          }
        }
      }
    }

    if (field === 'quantity' || field === 'rate') {
      const qty = updated[index].quantity || 0;
      const rate = updated[index].rate || 0;
      updated[index].amount = qty * rate;
    }

    setInvoiceItems(updated);
  };

  // Handles nested dispatches change for Multi mode
  const handleDispatchChange = async (itemIndex, dispIndex, field, value) => {
    const updated = [...invoiceItems];
    const dispatchRow = updated[itemIndex].dispatches[dispIndex];
    dispatchRow[field] = value;

    if (field === 'plantId' && value && updated[itemIndex].productId) {
      // Query stock level at selected plant dynamically
      try {
        const res = await api.get(`/products/${updated[itemIndex].productId}/inventory`);
        if (res.success) {
          const match = (res.stock || []).find(s => s.plantId?._id === value);
          dispatchRow.availStock = match ? match.availableQuantity : 0;
        }
      } catch (err) {
        console.error(err);
      }
    }

    setInvoiceItems(updated);
  };

  const addDispatchRow = (itemIndex) => {
    const updated = [...invoiceItems];
    updated[itemIndex].dispatches.push({ plantId: '', quantity: 1, availStock: 0 });
    setInvoiceItems(updated);
  };

  const removeDispatchRow = (itemIndex, dispIndex) => {
    const updated = [...invoiceItems];
    if (updated[itemIndex].dispatches.length === 1) return;
    updated[itemIndex].dispatches = updated[itemIndex].dispatches.filter((_, idx) => idx !== dispIndex);
    setInvoiceItems(updated);
  };

  const addItemRow = () => {
    setInvoiceItems([
      ...invoiceItems, 
      { 
        productId: '', 
        quantity: 1, 
        rate: 0, 
        amount: 0, 
        availStock: 0, 
        dispatches: [{ plantId: '', quantity: 1, availStock: 0 }] 
      }
    ]);
  };

  const removeItemRow = (index) => {
    if (invoiceItems.length === 1) return;
    setInvoiceItems(invoiceItems.filter((_, idx) => idx !== index));
  };

  // Calculations
  const subtotal = invoiceItems.reduce((sum, item) => sum + (item.amount || 0), 0);
  const gstAmount = Math.round(subtotal * 0.18 * 100) / 100;
  const grandTotal = subtotal + gstAmount;

  const handleCreateSubmit = async (values) => {
    const isMulti = dispatchType === 'Multi';

    // Basic product configuration check
    const invalidItems = invoiceItems.filter(item => !item.productId || item.quantity <= 0);
    if (invalidItems.length > 0) {
      return message.error('Please configure all product items properly');
    }

    // Normalizations & validations per item dispatch mode
    if (isMulti) {
      for (let i = 0; i < invoiceItems.length; i++) {
        const item = invoiceItems[i];
        const prod = products.find(p => p._id === item.productId);

        const dispatchSum = item.dispatches.reduce((sum, d) => sum + (d.quantity || 0), 0);
        if (dispatchSum !== item.quantity) {
          return message.error(
            `Line Item #${i + 1} (${prod ? prod.productName : 'Product'}): Sum of dispatches (${dispatchSum}) must equal ordered quantity (${item.quantity}).`
          );
        }

        // Available stock limit validation
        const outOfStockDisp = item.dispatches.find(d => d.quantity > d.availStock);
        if (outOfStockDisp) {
          const pl = plants.find(p => p._id === outOfStockDisp.plantId);
          return message.error(
            `Insufficient Stock: Plant "${pl ? pl.plantName : 'Location'}" has only ${outOfStockDisp.availStock} units of product "${prod?.productName}".`
          );
        }
      }
    } else {
      // Single plant dispatch validations
      if (!sourcePlant) {
        return message.error('Please select a source plant');
      }
      const outOfStockItems = invoiceItems.filter(item => item.quantity > item.availStock);
      if (outOfStockItems.length > 0) {
        const prod = products.find(p => p._id === outOfStockItems[0].productId);
        return message.error(
          `Insufficient Stock: Selected plant has only ${outOfStockItems[0].availStock} units of product "${prod?.productName}".`
        );
      }
    }

    try {
      const payload = {
        customer: values.customerId,
        dispatchType,
        sourcePlantId: isMulti ? undefined : sourcePlant,
        invoiceDate: values.invoiceDate ? values.invoiceDate.toDate() : new Date(),
        referenceNumber: values.referenceNumber || '',
        buyerOrderNumber: values.buyerOrderNumber || '',
        dispatchNumber: values.dispatchNumber || '',
        vehicleNumber: values.vehicleNumber || '',
        dispatchThrough: values.dispatchThrough || '',
        destination: values.destination || '',
        termsOfDelivery: values.termsOfDelivery || '',
        buyerName: values.buyerName || '',
        buyerAddress: values.buyerAddress || '',
        buyerGSTIN: values.buyerGSTIN || '',
        buyerState: values.buyerState || '',
        buyerStateCode: values.buyerStateCode || '',
        consigneeName: values.buyerName || '',
        consigneeAddress: values.buyerAddress || '',
        consigneeGSTIN: values.buyerGSTIN || '',
        consigneeState: values.buyerState || '',
        consigneeStateCode: values.buyerStateCode || '',
        gstType: values.gstType || 'CGST',
        items: invoiceItems.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          rate: item.rate,
          dispatches: isMulti 
            ? item.dispatches.map(d => ({ plantId: d.plantId, quantity: d.quantity })) 
            : [{ plantId: sourcePlant, quantity: item.quantity }]
        }))
      };

      const res = await api.post('/invoices', payload);
      if (res.success) {
        message.success('Invoice created successfully! Stock updated.');
        setIsCreateOpen(false);
        fetchInvoices(1, search);
      }
    } catch (err) {
      message.error(err.message || 'Invoice creation failed');
    }
  };

  // View / Print Modal
  const openInvoiceDetails = (invoice) => {
    setSelectedInvoice(invoice);
    setIsDetailOpen(true);
  };

  // Draw Barcode on print view
  useEffect(() => {
    if (selectedInvoice && printCanvasRef.current) {
      const canvas = printCanvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const num = selectedInvoice.invoiceNumber || 'INV-000000';
      ctx.fillStyle = '#000000';
      
      let x = 15;
      for (let i = 0; i < num.length; i++) {
        const bin = num.charCodeAt(i).toString(2).padStart(8, '0');
        for (let b = 0; b < bin.length; b++) {
          const w = bin[b] === '1' ? 3 : 1;
          ctx.fillRect(x, 8, w, 32);
          x += w + 1;
        }
      }
      ctx.font = '9px Courier';
      ctx.fillText(num, 30, 52);
    }
  }, [selectedInvoice, isDetailOpen]);

  const handleDownloadPDF = (id) => {
    const token = localStorage.getItem('token');
    window.open(`${import.meta.env.VITE_API_URL || '/api'}/invoices/${id}/pdf?token=${token}`, '_blank');
  };

  const columns = [
    {
      title: 'Invoice Number',
      dataIndex: 'invoiceNumber',
      key: 'invoiceNumber',
      render: (text) => <Tag color="blue" style={{ fontWeight: 600 }}>{text}</Tag>
    },
    {
      title: 'Date',
      dataIndex: 'invoiceDate',
      key: 'invoiceDate',
      render: (date) => new Date(date).toLocaleDateString()
    },
    {
      title: 'Customer',
      dataIndex: ['customer', 'customerName'],
      key: 'customerName',
      render: (text) => <b>{text}</b>
    },
    {
      title: 'Dispatch Mode',
      dataIndex: 'dispatchType',
      key: 'dispatchType',
      render: (type) => <Tag color={type === 'Multi' ? 'purple' : 'cyan'}>{type.toUpperCase()}</Tag>
    },
    {
      title: 'Grand Total (₹)',
      dataIndex: 'grandTotal',
      key: 'grandTotal',
      align: 'right',
      render: (val) => <b>{Number(val).toLocaleString()}</b>
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space size="middle">
          <Button 
            type="text" 
            icon={<EyeOutlined style={{ color: '#0d47a1' }} />} 
            onClick={() => openInvoiceDetails(record)}
          >
            View / Print
          </Button>
          <Button 
            type="primary" 
            ghost
            icon={<FilePdfOutlined />} 
            onClick={() => handleDownloadPDF(record._id)}
          >
            PDF
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <Card 
        title="GST Invoice Management"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
            Create GST Invoice
          </Button>
        }
      >
        <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', maxWidth: '350px' }}>
          <Input
            placeholder="Search Invoice Number..."
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
          dataSource={invoices}
          columns={columns}
          rowKey="_id"
          loading={loading}
          pagination={pagination}
          onChange={handleTableChange}
          bordered
        />
      </Card>

      {/* CREATE INVOICE MODAL */}
      <Modal
        title="Generate Tax Invoice"
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
            <Col span={6}>
              <Form.Item
                name="customerId"
                label="Customer / Client Billed"
                rules={[{ required: true, message: 'Please select a customer!' }]}
              >
                <Select placeholder="Billed to..." showSearch optionFilterProp="children" onChange={handleCustomerChange}>
                  {customers.map(c => (
                    <Option key={c._id} value={c._id}>{c.customerName}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="gstType" label="GST Type Option" rules={[{ required: true, message: 'Required' }]}>
                <Select placeholder="Select GST structure">
                  <Option value="CGST">CGST + SGST (9% + 9%)</Option>
                  <Option value="IGST">IGST (18%)</Option>
                  <Option value="Total GST">Total GST (18%)</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="dispatchType" label="Dispatch Mode">
                <Radio.Group onChange={(e) => setDispatchType(e.target.value)} value={dispatchType}>
                  <Radio.Button value="Single">Single Plant</Radio.Button>
                  <Radio.Button value="Multi">Multi Plant</Radio.Button>
                </Radio.Group>
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="invoiceDate" label="Invoice Date">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" style={{ margin: '12px 0' }}>Client / Buyer Details</Divider>
          <Row gutter={16} style={{ marginBottom: '8px' }}>
            <Col span={12}>
              <Form.Item name="buyerName" label="Client / Buyer Name" rules={[{ required: true, message: 'Required' }]}>
                <Input placeholder="Client name" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="buyerGSTIN" label="Client GSTIN" rules={[{ required: true, message: 'Required' }]}>
                <Input placeholder="e.g. 10AFRPJ8848R1ZJ" onChange={(e) => {
                  const val = e.target.value;
                  if (val && val.length >= 2) {
                    createForm.setFieldsValue({ buyerStateCode: val.slice(0, 2) });
                  }
                }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16} style={{ marginBottom: '8px' }}>
            <Col span={24}>
              <Form.Item name="buyerAddress" label="Client Delivery / Billing Address" rules={[{ required: true, message: 'Required' }]}>
                <Input.TextArea rows={2} placeholder="Client address" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16} style={{ marginBottom: '16px' }}>
            <Col span={12}>
              <Form.Item name="buyerState" label="State Name" rules={[{ required: true, message: 'Required' }]}>
                <Input placeholder="e.g. Bihar" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="buyerStateCode" label="State Code" rules={[{ required: true, message: 'Required' }]}>
                <Input placeholder="e.g. 10" />
              </Form.Item>
            </Col>
          </Row>

          {dispatchType === 'Single' && (
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="sourcePlantId"
                  label="Source Warehouse (Stock Out Location)"
                  rules={[{ required: true, message: 'Please select plant!' }]}
                >
                  <Select placeholder="Ship stock from..." onChange={handleSourcePlantChange}>
                    {plants.map(p => (
                      <Option key={p._id} value={p._id}>{p.plantName} ({p.plantCode})</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>
          )}

          <Divider orientation="left" style={{ margin: '12px 0' }}>Logistics & References</Divider>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item name="referenceNumber" label="Reference Number">
                <Input placeholder="e.g. REF-12345" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="buyerOrderNumber" label="Buyer Order Number">
                <Input placeholder="e.g. PO-8877" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="dispatchNumber" label="Dispatch Number">
                <Input placeholder="e.g. DISP-990" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="vehicleNumber" label="Vehicle Number">
                <Input placeholder="e.g. RJ52GB4525" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="dispatchThrough" label="Dispatch Through">
                <Input placeholder="e.g. Road Transport" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="destination" label="Destination">
                <Input placeholder="e.g. Jharkhand / Bihar" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="termsOfDelivery" label="Terms of Delivery">
                <Input placeholder="e.g. Immediate / Freight Paid" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" style={{ margin: '12px 0' }}>Invoice Items</Divider>

          {dispatchType === 'Single' && !sourcePlant ? (
            <Alert message="Please select a source warehouse plant before adding product lines." type="warning" showIcon />
          ) : (
            <div>
              {invoiceItems.map((item, index) => (
                <Card 
                  size="small" 
                  key={index} 
                  style={{ marginBottom: '12px', border: '1px solid #f0f0f0', borderRadius: '4px' }}
                  extra={
                    invoiceItems.length > 1 && (
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
                      <Form.Item label="Ordered Quantity" required>
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
                      <Form.Item label="Unit Rate (INR)" required>
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
                        Multi-Plant Dispatch Split:
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
                          <Col span={6}>
                            <InputNumber 
                              min={1} 
                              placeholder="Quantity" 
                              value={disp.quantity}
                              onChange={(val) => handleDispatchChange(index, dIdx, 'quantity', val)}
                              style={{ width: '100%' }}
                            />
                            <div style={{ fontSize: '10px', color: '#999' }}>
                              Avail Stock: {disp.availStock}
                            </div>
                          </Col>
                          <Col span={4}>
                            <Button 
                              type="text" 
                              danger 
                              icon={<DeleteOutlined />} 
                              onClick={() => removeDispatchRow(index, dIdx)}
                              disabled={item.dispatches.length === 1}
                            />
                          </Col>
                        </Row>
                      ))}
                      <Button 
                        type="dashed" 
                        size="small" 
                        icon={<PlusCircleOutlined />} 
                        onClick={() => addDispatchRow(index)}
                      >
                        Add Dispatch Location Split
                      </Button>
                    </div>
                  )}
                </Card>
              ))}

              <Button type="dashed" onClick={addItemRow} icon={<PlusCircleOutlined />} style={{ width: '100%', marginTop: '12px' }}>
                Add Product Item Row
              </Button>
            </div>
          )}

          <Divider style={{ margin: '16px 0' }} />

          {/* Totals Summary */}
          <Row justify="end">
            <Col span={10}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', border: '1px solid #f0f2f5', padding: '16px', borderRadius: '6px', backgroundColor: '#fafafa' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#666' }}>Subtotal:</span>
                  <span style={{ fontWeight: 500 }}>₹{subtotal.toFixed(2)}</span>
                </div>
                {selectedGstType === 'CGST' ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#666' }}>CGST (9%):</span>
                      <span style={{ fontWeight: 500 }}>₹{(gstAmount / 2).toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#666' }}>SGST (9%):</span>
                      <span style={{ fontWeight: 500 }}>₹{(gstAmount / 2).toFixed(2)}</span>
                    </div>
                  </>
                ) : selectedGstType === 'IGST' ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#666' }}>IGST (18%):</span>
                    <span style={{ fontWeight: 500 }}>₹{gstAmount.toFixed(2)}</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#666' }}>Total GST (18%):</span>
                    <span style={{ fontWeight: 500 }}>₹{gstAmount.toFixed(2)}</span>
                  </div>
                )}
                <Divider style={{ margin: '8px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '15px' }}>Grand Total (INR):</span>
                  <span style={{ fontWeight: 'bold', fontSize: '15px', color: '#0d47a1' }}>₹{grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </Col>
          </Row>

          <Form.Item style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 0, marginTop: '20px' }}>
            <Space>
              <Button onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit">Generate Tax Invoice</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* PRINT DETAILS MODAL */}
      <Modal
        title="Tax Invoice Preview"
        open={isDetailOpen}
        onCancel={() => setIsDetailOpen(false)}
        footer={[
          <Button key="pdf" type="primary" ghost icon={<FilePdfOutlined />} onClick={() => handleDownloadPDF(selectedInvoice._id)}>
            Download PDF
          </Button>,
          <Button key="print" type="primary" icon={<PrinterOutlined />} onClick={() => window.print()}>
            Print Page
          </Button>,
          <Button key="close" onClick={() => setIsDetailOpen(false)}>Close</Button>
        ]}
        width={750}
        destroyOnClose
      >
        {selectedInvoice && (() => {
          const hsnGroups = {};
          (selectedInvoice.products || []).forEach(item => {
            const code = item.productId?.hsnCode || '72042590';
            if (!hsnGroups[code]) {
              hsnGroups[code] = { taxable: 0, tax: 0 };
            }
            hsnGroups[code].taxable += item.amount || 0;
          });

          const formatDateStr = (d) => {
            if (!d) return 'N/A';
            const date = new Date(d);
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return `${date.getDate()}-${months[date.getMonth()]}-${String(date.getFullYear()).slice(-2)}`;
          };

          const pad = (n) => String(n).padStart(2, '0');
          const dObj = new Date(selectedInvoice.createdAt || selectedInvoice.invoiceDate || Date.now());
          const signatureDateStr = `${dObj.getFullYear()}.${pad(dObj.getMonth() + 1)}.${pad(dObj.getDate())} ${pad(dObj.getHours())}:${pad(dObj.getMinutes())}:${pad(dObj.getSeconds())} +05'30'`;

          // Amount in words conversion
          const getWords = (num) => {
            const a = ['','One ','Two ','Three ','Four ','Five ','Six ','Seven ','Eight ','Nine ','Ten ','Eleven ','Twelve ','Thirteen ','Fourteen ','Fifteen ','Sixteen ','Seventeen ','Eighteen ','Nineteen '];
            const b = ['', '', 'Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
            const n = ('000000000' + Math.round(num)).substr(-9);
            if (num === 0) return 'Zero';
            let str = '';
            // Crores
            const crores = parseInt(n.substr(0, 2));
            if (crores > 0) {
              str += (crores < 20 ? a[crores] : b[parseInt(String(crores)[0])] + ' ' + a[parseInt(String(crores)[1])]) + 'Crore ';
            }
            // Lakhs
            const lakhs = parseInt(n.substr(2, 2));
            if (lakhs > 0) {
              str += (lakhs < 20 ? a[lakhs] : b[parseInt(String(lakhs)[0])] + ' ' + a[parseInt(String(lakhs)[1])]) + 'Lakh ';
            }
            // Thousands
            const thousands = parseInt(n.substr(4, 2));
            if (thousands > 0) {
              str += (thousands < 20 ? a[thousands] : b[parseInt(String(thousands)[0])] + ' ' + a[parseInt(String(thousands)[1])]) + 'Thousand ';
            }
            // Hundreds
            const hundreds = parseInt(n.substr(6, 1));
            if (hundreds > 0) {
              str += a[hundreds] + 'Hundred ';
            }
            // Tens & Ones
            const tens = parseInt(n.substr(7, 2));
            if (tens > 0) {
              str += (tens < 20 ? a[tens] : b[parseInt(String(tens)[0])] + ' ' + a[parseInt(String(tens)[1])]);
            }
            return 'INR ' + str.trim() + ' Only';
          };

          return (
            <div id="invoice-print-area" style={{
              fontFamily: '"Courier New", Courier, monospace, Arial, Helvetica',
              fontSize: '11px',
              color: '#000000',
              lineHeight: '1.3',
              border: '1.5px solid #000000',
              padding: '0',
              backgroundColor: '#ffffff',
              boxSizing: 'border-box'
            }}>
              {/* Header Title */}
              <div style={{
                textAlign: 'center',
                fontWeight: 'bold',
                fontSize: '13px',
                borderBottom: '1.2px solid #000000',
                padding: '4px 0',
                textTransform: 'uppercase',
                letterSpacing: '1px'
              }}>
                Tax Invoice
              </div>

              {/* Grid block */}
              <div style={{ display: 'grid', gridTemplateColumns: '50% 50%', width: '100%' }}>
                
                {/* Left Side Details */}
                <div style={{ borderRight: '1.2px solid #000000', display: 'flex', flexDirection: 'column' }}>
                  
                  {/* Seller Details */}
                  <div style={{ padding: '6px', borderBottom: '1.2px solid #000000', minHeight: '80px' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '12px' }}>M.A. OIL</div>
                    <div>Purani Basti Road Jugsalai, Jamshedpur</div>
                    <div style={{ marginTop: '4px' }}>GSTIN/UIN: 20AGLPM2087Q1ZY</div>
                    <div>State Name : Jharkhand, Code : 20</div>
                  </div>

                  {/* Consignee Details */}
                  <div style={{ padding: '6px', borderBottom: '1.2px solid #000000', minHeight: '80px' }}>
                    <div style={{ fontWeight: 'bold', color: '#555', fontSize: '9px' }}>Consignee (Ship to)</div>
                    <div style={{ fontWeight: 'bold', marginTop: '2px' }}>{selectedInvoice.consigneeName || selectedInvoice.customer?.customerName}</div>
                    <div>{selectedInvoice.consigneeAddress || (selectedInvoice.customer ? `${selectedInvoice.customer.address || ''}, ${selectedInvoice.customer.city || ''}` : '')}</div>
                    <div style={{ marginTop: '4px' }}>GSTIN/UIN: {selectedInvoice.consigneeGSTIN || selectedInvoice.customer?.gstNumber || 'N/A'}</div>
                    <div>State Name : {selectedInvoice.consigneeState || selectedInvoice.customer?.state || 'N/A'}, Code : {selectedInvoice.consigneeStateCode || (selectedInvoice.consigneeGSTIN ? selectedInvoice.consigneeGSTIN.slice(0, 2) : '') || 'N/A'}</div>
                  </div>

                  {/* Buyer Details */}
                  <div style={{ padding: '6px', minHeight: '80px' }}>
                    <div style={{ fontWeight: 'bold', color: '#555', fontSize: '9px' }}>Buyer (Bill to)</div>
                    <div style={{ fontWeight: 'bold', marginTop: '2px' }}>{selectedInvoice.buyerName || selectedInvoice.customer?.customerName}</div>
                    <div>{selectedInvoice.buyerAddress || (selectedInvoice.customer ? `${selectedInvoice.customer.address || ''}, ${selectedInvoice.customer.city || ''}` : '')}</div>
                    <div style={{ marginTop: '4px' }}>GSTIN/UIN: {selectedInvoice.buyerGSTIN || selectedInvoice.customer?.gstNumber || 'N/A'}</div>
                    <div>State Name : {selectedInvoice.buyerState || selectedInvoice.customer?.state || 'N/A'}, Code : {selectedInvoice.buyerStateCode || (selectedInvoice.buyerGSTIN ? selectedInvoice.buyerGSTIN.slice(0, 2) : '') || 'N/A'}</div>
                  </div>

                </div>

                {/* Right Side Logistics */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '50% 50%', borderBottom: '1px solid #000000' }}>
                    <div style={{ padding: '4px', borderRight: '1px solid #000000' }}>
                      <div style={{ fontSize: '8px', color: '#555' }}>Invoice No.</div>
                      <div style={{ fontWeight: 'bold' }}>{selectedInvoice.invoiceNumber}</div>
                    </div>
                    <div style={{ padding: '4px' }}>
                      <div style={{ fontSize: '8px', color: '#555' }}>Dated</div>
                      <div style={{ fontWeight: 'bold' }}>{formatDateStr(selectedInvoice.invoiceDate)}</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '50% 50%', borderBottom: '1px solid #000000' }}>
                    <div style={{ padding: '4px', borderRight: '1px solid #000000' }}>
                      <div style={{ fontSize: '8px', color: '#555' }}>Delivery Note</div>
                      <div style={{ fontWeight: 'bold' }}>{selectedInvoice.dispatchNumber || 'N/A'}</div>
                    </div>
                    <div style={{ padding: '4px' }}>
                      <div style={{ fontSize: '8px', color: '#555' }}>Mode/Terms of Payment</div>
                      <div style={{ fontWeight: 'bold' }}>{selectedInvoice.termsOfDelivery || 'N/A'}</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '50% 50%', borderBottom: '1px solid #000000' }}>
                    <div style={{ padding: '4px', borderRight: '1px solid #000000' }}>
                      <div style={{ fontSize: '8px', color: '#555' }}>Reference No. & Date</div>
                      <div style={{ fontWeight: 'bold' }}>{selectedInvoice.referenceNumber || 'N/A'}</div>
                    </div>
                    <div style={{ padding: '4px' }}>
                      <div style={{ fontSize: '8px', color: '#555' }}>Other References</div>
                      <div style={{ fontWeight: 'bold' }}>N/A</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '50% 50%', borderBottom: '1px solid #000000' }}>
                    <div style={{ padding: '4px', borderRight: '1px solid #000000' }}>
                      <div style={{ fontSize: '8px', color: '#555' }}>Buyer's Order No.</div>
                      <div style={{ fontWeight: 'bold' }}>{selectedInvoice.buyerOrderNumber || 'N/A'}</div>
                    </div>
                    <div style={{ padding: '4px' }}>
                      <div style={{ fontSize: '8px', color: '#555' }}>Dated</div>
                      <div style={{ fontWeight: 'bold' }}>{formatDateStr(selectedInvoice.invoiceDate)}</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '50% 50%', borderBottom: '1px solid #000000' }}>
                    <div style={{ padding: '4px', borderRight: '1px solid #000000' }}>
                      <div style={{ fontSize: '8px', color: '#555' }}>Dispatch Doc No.</div>
                      <div style={{ fontWeight: 'bold' }}>{selectedInvoice.dispatchNumber || 'N/A'}</div>
                    </div>
                    <div style={{ padding: '4px' }}>
                      <div style={{ fontSize: '8px', color: '#555' }}>Delivery Note Date</div>
                      <div style={{ fontWeight: 'bold' }}>{formatDateStr(selectedInvoice.invoiceDate)}</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '50% 50%', borderBottom: '1px solid #000000' }}>
                    <div style={{ padding: '4px', borderRight: '1px solid #000000' }}>
                      <div style={{ fontSize: '8px', color: '#555' }}>Dispatched through</div>
                      <div style={{ fontWeight: 'bold' }}>{selectedInvoice.dispatchThrough || 'By Road'}</div>
                    </div>
                    <div style={{ padding: '4px' }}>
                      <div style={{ fontSize: '8px', color: '#555' }}>Destination</div>
                      <div style={{ fontWeight: 'bold' }}>{selectedInvoice.destination || 'N/A'}</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '50% 50%', borderBottom: '1px solid #000000' }}>
                    <div style={{ padding: '4px', borderRight: '1px solid #000000' }}>
                      <div style={{ fontSize: '8px', color: '#555' }}>Bill of Lading/LR-RR No.</div>
                      <div style={{ fontWeight: 'bold' }}>{selectedInvoice.referenceNumber || 'N/A'}</div>
                    </div>
                    <div style={{ padding: '4px' }}>
                      <div style={{ fontSize: '8px', color: '#555' }}>Motor Vehicle No.</div>
                      <div style={{ fontWeight: 'bold' }}>{selectedInvoice.vehicleNumber || 'N/A'}</div>
                    </div>
                  </div>

                  <div style={{ padding: '6px', flex: 1 }}>
                    <div style={{ fontSize: '8px', color: '#555' }}>Terms of Delivery</div>
                    <div>{selectedInvoice.termsOfDelivery || 'Delivered to Buyer site.'}</div>
                  </div>

                </div>

              </div>

              {/* Product Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: '1.2px solid #000000', borderBottom: '1.2px solid #000000' }}>
                <thead>
                  <tr style={{ borderBottom: '1.2px solid #000000', fontWeight: 'bold', textAlign: 'left', fontSize: '10px' }}>
                    <th style={{ padding: '4px', borderRight: '1.2px solid #000000', width: '5%' }}>Sl No.</th>
                    <th style={{ padding: '4px', borderRight: '1.2px solid #000000', width: '50%' }}>Description of Goods</th>
                    <th style={{ padding: '4px', borderRight: '1.2px solid #000000', width: '12%' }}>HSN/SAC</th>
                    <th style={{ padding: '4px', borderRight: '1.2px solid #000000', width: '10%', textAlign: 'right' }}>Quantity</th>
                    <th style={{ padding: '4px', borderRight: '1.2px solid #000000', width: '10%', textAlign: 'right' }}>Rate</th>
                    <th style={{ padding: '4px', borderRight: '1.2px solid #000000', width: '5%' }}>per</th>
                    <th style={{ padding: '4px', textAlign: 'right', width: '12%' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedInvoice.products || []).map((item, idx) => (
                    <tr key={idx} style={{ verticalAlign: 'top' }}>
                      <td style={{ padding: '4px', borderRight: '1.2px solid #000000', textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ padding: '4px', borderRight: '1.2px solid #000000' }}>
                        <div style={{ fontWeight: 'bold' }}>{item.productId?.productName}</div>
                        <div style={{ fontSize: '9px', color: '#555', marginTop: '1px' }}>
                          Specs: {item.productId?.capacity} | {item.productId?.materialType}
                        </div>
                        {selectedInvoice.dispatchType === 'Multi' && (
                          <div style={{ fontSize: '8px', color: '#666', marginTop: '3px' }}>
                            Split Dispatches: {(item.dispatches || []).map(d => `${d.plantId?.plantCode}: ${d.quantity}`).join(', ')}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '4px', borderRight: '1.2px solid #000000' }}>{item.productId?.hsnCode || '72042590'}</td>
                      <td style={{ padding: '4px', borderRight: '1.2px solid #000000', textAlign: 'right', fontWeight: 'bold' }}>{item.quantity} {item.productId?.unit || 'Nos'}</td>
                      <td style={{ padding: '4px', borderRight: '1.2px solid #000000', textAlign: 'right' }}>{Number(item.rate).toFixed(2)}</td>
                      <td style={{ padding: '4px', borderRight: '1.2px solid #000000' }}>{item.productId?.unit || 'Nos'}</td>
                      <td style={{ padding: '4px', textAlign: 'right', fontWeight: 'bold' }}>{Number(item.amount).toFixed(2)}</td>
                    </tr>
                  ))}

                  {/* GST calculations */}
                  {selectedInvoice.gstType === 'CGST' ? (
                    <>
                      <tr>
                        <td style={{ borderRight: '1.2px solid #000000' }}></td>
                        <td style={{ padding: '4px', borderRight: '1.2px solid #000000', textAlign: 'right', fontWeight: 'bold' }}>Output CGST @ 9%</td>
                        <td style={{ borderRight: '1.2px solid #000000' }}></td>
                        <td style={{ borderRight: '1.2px solid #000000' }}></td>
                        <td style={{ padding: '4px', borderRight: '1.2px solid #000000', textAlign: 'right' }}>9 %</td>
                        <td style={{ borderRight: '1.2px solid #000000' }}></td>
                        <td style={{ padding: '4px', textAlign: 'right', fontWeight: 'bold' }}>{Number(selectedInvoice.gstAmount / 2).toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td style={{ borderRight: '1.2px solid #000000' }}></td>
                        <td style={{ padding: '4px', borderRight: '1.2px solid #000000', textAlign: 'right', fontWeight: 'bold' }}>Output SGST @ 9%</td>
                        <td style={{ borderRight: '1.2px solid #000000' }}></td>
                        <td style={{ borderRight: '1.2px solid #000000' }}></td>
                        <td style={{ padding: '4px', borderRight: '1.2px solid #000000', textAlign: 'right' }}>9 %</td>
                        <td style={{ borderRight: '1.2px solid #000000' }}></td>
                        <td style={{ padding: '4px', textAlign: 'right', fontWeight: 'bold' }}>{Number(selectedInvoice.gstAmount / 2).toFixed(2)}</td>
                      </tr>
                    </>
                  ) : selectedInvoice.gstType === 'IGST' ? (
                    <tr>
                      <td style={{ borderRight: '1.2px solid #000000' }}></td>
                      <td style={{ padding: '4px', borderRight: '1.2px solid #000000', textAlign: 'right', fontWeight: 'bold' }}>Output IGST @ 18%</td>
                      <td style={{ borderRight: '1.2px solid #000000' }}></td>
                      <td style={{ borderRight: '1.2px solid #000000' }}></td>
                      <td style={{ padding: '4px', borderRight: '1.2px solid #000000', textAlign: 'right' }}>18 %</td>
                      <td style={{ borderRight: '1.2px solid #000000' }}></td>
                      <td style={{ padding: '4px', textAlign: 'right', fontWeight: 'bold' }}>{Number(selectedInvoice.gstAmount).toFixed(2)}</td>
                    </tr>
                  ) : (
                    <tr>
                      <td style={{ borderRight: '1.2px solid #000000' }}></td>
                      <td style={{ padding: '4px', borderRight: '1.2px solid #000000', textAlign: 'right', fontWeight: 'bold' }}>Output GST @ 18%</td>
                      <td style={{ borderRight: '1.2px solid #000000' }}></td>
                      <td style={{ borderRight: '1.2px solid #000000' }}></td>
                      <td style={{ padding: '4px', borderRight: '1.2px solid #000000', textAlign: 'right' }}>18 %</td>
                      <td style={{ borderRight: '1.2px solid #000000' }}></td>
                      <td style={{ padding: '4px', textAlign: 'right', fontWeight: 'bold' }}>{Number(selectedInvoice.gstAmount).toFixed(2)}</td>
                    </tr>
                  )}

                  {/* Empty spacers */}
                  <tr style={{ height: '50px' }}>
                    <td style={{ borderRight: '1.2px solid #000000' }}></td>
                    <td style={{ borderRight: '1.2px solid #000000' }}></td>
                    <td style={{ borderRight: '1.2px solid #000000' }}></td>
                    <td style={{ borderRight: '1.2px solid #000000' }}></td>
                    <td style={{ borderRight: '1.2px solid #000000' }}></td>
                    <td style={{ borderRight: '1.2px solid #000000' }}></td>
                    <td></td>
                  </tr>

                  {/* Total Row */}
                  <tr style={{ borderTop: '1.2px solid #000000', fontWeight: 'bold' }}>
                    <td style={{ borderRight: '1.2px solid #000000' }}></td>
                    <td style={{ padding: '4px', borderRight: '1.2px solid #000000', textAlign: 'center' }}>Total</td>
                    <td style={{ borderRight: '1.2px solid #000000' }}></td>
                    <td style={{ padding: '4px', borderRight: '1.2px solid #000000', textAlign: 'right' }}>
                      {selectedInvoice.products.reduce((s, p) => s + p.quantity, 0)} {selectedInvoice.products[0]?.productId?.unit || 'Nos'}
                    </td>
                    <td style={{ borderRight: '1.2px solid #000000' }}></td>
                    <td style={{ borderRight: '1.2px solid #000000' }}></td>
                    <td style={{ padding: '4px', textAlign: 'right' }}>Rs. {Number(selectedInvoice.grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                </tbody>
              </table>

              {/* Amount in words */}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px', borderBottom: '1.2px solid #000000' }}>
                <div>
                  <div style={{ fontSize: '8px', color: '#555' }}>Amount Chargeable (in words)</div>
                  <div style={{ fontWeight: 'bold' }}>{getWords(selectedInvoice.grandTotal)}</div>
                </div>
                <div style={{ fontStyle: 'italic', fontWeight: 'bold', alignSelf: 'center' }}>E. & O.E.</div>
              </div>

              {/* HSN Summary Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', borderBottom: '1.2px solid #000000', fontSize: '10px' }}>
                <thead>
                  {selectedInvoice.gstType === 'CGST' ? (
                    <>
                      <tr style={{ borderBottom: '1.2px solid #000000', textAlign: 'left', fontWeight: 'bold' }}>
                        <th style={{ padding: '4px', borderRight: '1.2px solid #000000', width: '20%' }} rowSpan="2">HSN/SAC</th>
                        <th style={{ padding: '4px', borderRight: '1.2px solid #000000', width: '20%', textAlign: 'right' }} rowSpan="2">Taxable Value</th>
                        <th style={{ padding: '4px', borderRight: '1.2px solid #000000', textAlign: 'center', width: '24%' }} colSpan="2">Central Tax</th>
                        <th style={{ padding: '4px', borderRight: '1.2px solid #000000', textAlign: 'center', width: '24%' }} colSpan="2">State Tax</th>
                        <th style={{ padding: '4px', textAlign: 'right', width: '12%' }} rowSpan="2">Total Tax Amount</th>
                      </tr>
                      <tr style={{ borderBottom: '1.2px solid #000000', fontWeight: 'bold' }}>
                        <th style={{ padding: '4px', borderRight: '1.2px solid #000000', textAlign: 'right' }}>Rate</th>
                        <th style={{ padding: '4px', borderRight: '1.2px solid #000000', textAlign: 'right' }}>Amount</th>
                        <th style={{ padding: '4px', borderRight: '1.2px solid #000000', textAlign: 'right' }}>Rate</th>
                        <th style={{ padding: '4px', borderRight: '1.2px solid #000000', textAlign: 'right' }}>Amount</th>
                      </tr>
                    </>
                  ) : (
                    <>
                      <tr style={{ borderBottom: '1.2px solid #000000', textAlign: 'left', fontWeight: 'bold' }}>
                        <th style={{ padding: '4px', borderRight: '1.2px solid #000000', width: '30%' }} rowSpan="2">HSN/SAC</th>
                        <th style={{ padding: '4px', borderRight: '1.2px solid #000000', width: '25%', textAlign: 'right' }} rowSpan="2">Taxable Value</th>
                        <th style={{ padding: '4px', borderRight: '1.2px solid #000000', textAlign: 'center', width: '30%' }} colSpan="2">
                          {selectedInvoice.gstType === 'IGST' ? 'Integrated Tax' : 'Total GST'}
                        </th>
                        <th style={{ padding: '4px', textAlign: 'right', width: '15%' }} rowSpan="2">Total Tax Amount</th>
                      </tr>
                      <tr style={{ borderBottom: '1.2px solid #000000', fontWeight: 'bold' }}>
                        <th style={{ padding: '4px', borderRight: '1.2px solid #000000', textAlign: 'right' }}>Rate</th>
                        <th style={{ padding: '4px', borderRight: '1.2px solid #000000', textAlign: 'right' }}>Amount</th>
                      </tr>
                    </>
                  )}
                </thead>
                <tbody>
                  {Object.keys(hsnGroups).map(code => {
                    const data = hsnGroups[code];
                    const itemTax = Math.round(data.taxable * 0.18 * 100) / 100;
                    return (
                      <tr key={code}>
                        <td style={{ padding: '4px', borderRight: '1.2px solid #000000' }}>{code}</td>
                        <td style={{ padding: '4px', borderRight: '1.2px solid #000000', textAlign: 'right' }}>{Number(data.taxable).toFixed(2)}</td>
                        {selectedInvoice.gstType === 'CGST' ? (
                          <>
                            <td style={{ padding: '4px', borderRight: '1.2px solid #000000', textAlign: 'right' }}>9%</td>
                            <td style={{ padding: '4px', borderRight: '1.2px solid #000000', textAlign: 'right' }}>{Number(itemTax / 2).toFixed(2)}</td>
                            <td style={{ padding: '4px', borderRight: '1.2px solid #000000', textAlign: 'right' }}>9%</td>
                            <td style={{ padding: '4px', borderRight: '1.2px solid #000000', textAlign: 'right' }}>{Number(itemTax / 2).toFixed(2)}</td>
                          </>
                        ) : (
                          <>
                            <td style={{ padding: '4px', borderRight: '1.2px solid #000000', textAlign: 'right' }}>18%</td>
                            <td style={{ padding: '4px', borderRight: '1.2px solid #000000', textAlign: 'right' }}>{Number(itemTax).toFixed(2)}</td>
                          </>
                        )}
                        <td style={{ padding: '4px', textAlign: 'right', fontWeight: 'bold' }}>{Number(itemTax).toFixed(2)}</td>
                      </tr>
                    );
                  })}
                  <tr style={{ borderTop: '1.2px solid #000000', fontWeight: 'bold' }}>
                    <td style={{ padding: '4px', borderRight: '1.2px solid #000000' }}>Total</td>
                    <td style={{ padding: '4px', borderRight: '1.2px solid #000000', textAlign: 'right' }}>{Number(selectedInvoice.subtotal).toFixed(2)}</td>
                    {selectedInvoice.gstType === 'CGST' ? (
                      <>
                        <td style={{ borderRight: '1.2px solid #000000' }}></td>
                        <td style={{ padding: '4px', borderRight: '1.2px solid #000000', textAlign: 'right' }}>{Number(selectedInvoice.gstAmount / 2).toFixed(2)}</td>
                        <td style={{ borderRight: '1.2px solid #000000' }}></td>
                        <td style={{ padding: '4px', borderRight: '1.2px solid #000000', textAlign: 'right' }}>{Number(selectedInvoice.gstAmount / 2).toFixed(2)}</td>
                      </>
                    ) : (
                      <>
                        <td style={{ borderRight: '1.2px solid #000000' }}></td>
                        <td style={{ padding: '4px', borderRight: '1.2px solid #000000', textAlign: 'right' }}>{Number(selectedInvoice.gstAmount).toFixed(2)}</td>
                      </>
                    )}
                    <td style={{ padding: '4px', textAlign: 'right' }}>{Number(selectedInvoice.gstAmount).toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>

              {/* Tax Amount in words */}
              <div style={{ padding: '6px', borderBottom: '1.2px solid #000000' }}>
                <span style={{ fontSize: '8px', color: '#555' }}>Tax Amount (in words) : </span>
                <span style={{ fontWeight: 'bold' }}>{getWords(selectedInvoice.gstAmount)}</span>
              </div>

              {/* Declaration & Signatures */}
              <div style={{ display: 'grid', gridTemplateColumns: '60% 40%', width: '100%' }}>
                <div style={{ padding: '6px', borderRight: '1.2px solid #000000', fontSize: '9px' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '8px', color: '#555' }}>Declaration:</div>
                  <div style={{ marginTop: '2px', lineHeight: '1.2' }}>
                    We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
                  </div>
                </div>

                {/* Signature box mimicking Tally checkmark exactly */}
                <div style={{ padding: '6px', display: 'flex', flexDirection: 'column', minHeight: '95px', position: 'relative' }}>
                  <div style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '9px' }}>for M.A. Oil</div>
                  
                  {/* Digital Signature box */}
                  <div style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    border: '1px dashed #d32f2f',
                    borderRadius: '4px',
                    backgroundColor: '#fffdfd',
                    padding: '3px',
                    margin: '4px 0',
                    color: '#d32f2f',
                    fontSize: '8px',
                    lineHeight: '1.1'
                  }}>
                    <div style={{ fontWeight: 'bold', fontSize: '9.5px', textTransform: 'uppercase' }}>MOHAMMAD MUMTAJ</div>
                    <div style={{ fontSize: '7.5px', color: '#666' }}>
                      Digitally signed by MOHAMMAD MUMTAJ<br/>
                      Date: {signatureDateStr}
                    </div>
                  </div>

                  <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '9.5px', marginTop: 'auto' }}>
                    Authorised Signatory
                  </div>
                </div>

              </div>

            </div>
          );
        })()}
      </Modal>
    </div>
  );
};

export default Invoices;
