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
        {selectedInvoice && (
          <div id="invoice-print-area" style={{ padding: '20px', border: '1px solid #eef2f6', borderRadius: '8px', backgroundColor: '#ffffff' }}>
            {/* Invoice Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div>
                <h2 style={{ color: '#1b5e20', margin: 0 }}>MSME CONTAINER TRADING SYSTEM</h2>
                <p style={{ margin: 0, fontSize: '11px', color: '#666' }}>Logistics Tracker & Distribution Portal</p>
                {selectedInvoice.dispatchType === 'Multi' ? (
                  <p style={{ margin: '5px 0 0 0', fontSize: '11px' }}><b>Dispatch Mode:</b> Multi-Plant Dispatch</p>
                ) : (
                  <>
                    <p style={{ margin: '5px 0 0 0', fontSize: '11px' }}><b>Source Plant:</b> {selectedInvoice.sourcePlantId?.plantName}</p>
                    <p style={{ margin: 0, fontSize: '11px' }}><b>Plant Code:</b> {selectedInvoice.sourcePlantId?.plantCode}</p>
                  </>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <h3 style={{ color: '#0d47a1', margin: 0 }}>TAX INVOICE</h3>
                <p style={{ margin: 0, fontSize: '11px' }}><b>Invoice No:</b> {selectedInvoice.invoiceNumber}</p>
                <p style={{ margin: 0, fontSize: '11px' }}><b>Date:</b> {new Date(selectedInvoice.invoiceDate).toLocaleDateString()}</p>
                <canvas 
                  ref={printCanvasRef} 
                  width={150} 
                  height={60} 
                  style={{ border: '1px solid #f0f0f0', borderRadius: '3px', marginTop: '10px' }} 
                />
              </div>
            </div>

            <Divider style={{ margin: '12px 0' }} />

            {/* Billed info */}
            <Row gutter={16} style={{ marginBottom: '20px' }}>
              <Col span={12}>
                <h5 style={{ color: '#1a237e', margin: '0 0 6px 0', fontSize: '12px' }}>Buyer (Bill to):</h5>
                <p style={{ margin: '0 0 2px 0', fontSize: '12px' }}><b>{selectedInvoice.buyerName || selectedInvoice.customer?.customerName}</b></p>
                <p style={{ margin: '0 0 2px 0', fontSize: '11px' }}>GSTIN: {selectedInvoice.buyerGSTIN || selectedInvoice.customer?.gstNumber || 'N/A'}</p>
                <p style={{ margin: '0 0 2px 0', fontSize: '11px', color: '#666' }}>Address: {selectedInvoice.buyerAddress || (selectedInvoice.customer ? `${selectedInvoice.customer.address || ''}, ${selectedInvoice.customer.city || ''}` : '')}</p>
                <p style={{ margin: '0 0 2px 0', fontSize: '11px' }}>State: {selectedInvoice.buyerState || selectedInvoice.customer?.state || 'N/A'} (Code: {selectedInvoice.buyerStateCode || (selectedInvoice.buyerGSTIN ? selectedInvoice.buyerGSTIN.slice(0, 2) : '') || 'N/A'})</p>
              </Col>
              <Col span={12}>
                <h5 style={{ color: '#1a237e', margin: '0 0 6px 0', fontSize: '12px' }}>Consignee (Ship to):</h5>
                <p style={{ margin: '0 0 2px 0', fontSize: '12px' }}><b>{selectedInvoice.consigneeName || selectedInvoice.customer?.customerName}</b></p>
                <p style={{ margin: '0 0 2px 0', fontSize: '11px' }}>GSTIN: {selectedInvoice.consigneeGSTIN || selectedInvoice.customer?.gstNumber || 'N/A'}</p>
                <p style={{ margin: '0 0 2px 0', fontSize: '11px', color: '#666' }}>Address: {selectedInvoice.consigneeAddress || (selectedInvoice.customer ? `${selectedInvoice.customer.address || ''}, ${selectedInvoice.customer.city || ''}` : '')}</p>
                <p style={{ margin: '0 0 2px 0', fontSize: '11px' }}>State: {selectedInvoice.consigneeState || selectedInvoice.customer?.state || 'N/A'} (Code: {selectedInvoice.consigneeStateCode || (selectedInvoice.consigneeGSTIN ? selectedInvoice.consigneeGSTIN.slice(0, 2) : '') || 'N/A'})</p>
              </Col>
            </Row>

            <Row gutter={16} style={{ marginBottom: '20px' }}>
              <Col span={24}>
                <h5 style={{ color: '#1a237e', margin: '0 0 6px 0', fontSize: '12px' }}>Logistics & References:</h5>
                <div style={{ fontSize: '11px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  {selectedInvoice.referenceNumber && <div><b>Reference No:</b> {selectedInvoice.referenceNumber}</div>}
                  {selectedInvoice.buyerOrderNumber && <div><b>Buyer Order No:</b> {selectedInvoice.buyerOrderNumber}</div>}
                  {selectedInvoice.dispatchNumber && <div><b>Dispatch No:</b> {selectedInvoice.dispatchNumber}</div>}
                  {selectedInvoice.vehicleNumber && <div><b>Vehicle No:</b> {selectedInvoice.vehicleNumber}</div>}
                  {selectedInvoice.dispatchThrough && <div><b>Dispatch Through:</b> {selectedInvoice.dispatchThrough}</div>}
                  {selectedInvoice.destination && <div><b>Destination:</b> {selectedInvoice.destination}</div>}
                  {selectedInvoice.termsOfDelivery && <div><b>Terms of Delivery:</b> {selectedInvoice.termsOfDelivery}</div>}
                </div>
              </Col>
            </Row>

            {/* Items Table */}
            <Table
              dataSource={selectedInvoice.products}
              rowKey="_id"
              pagination={false}
              size="small"
              bordered
              columns={[
                {
                  title: '#',
                  key: 'idx',
                  render: (_, __, i) => i + 1
                },
                {
                  title: 'Product Master',
                  dataIndex: ['productId', 'productName'],
                  key: 'productName',
                  render: (text, rec) => (
                    <span>
                      <b>{text}</b> <br />
                      <span style={{ fontSize: '10px', color: '#888' }}>
                        Specs: {rec.productId?.capacity} | {rec.productId?.materialType}
                      </span>
                    </span>
                  )
                },
                {
                  title: 'Plant Dispatches Allocation',
                  key: 'dispatches',
                  render: (_, rec) => (
                    <Space direction="vertical" size="small" style={{ width: '100%' }}>
                      {(rec.dispatches || []).map((d, idx) => (
                        <Tag color="purple" key={idx}>
                          {d.plantId?.plantName} ({d.plantId?.plantCode}): <b>{d.quantity}</b> Units
                        </Tag>
                      ))}
                    </Space>
                  )
                },
                {
                  title: 'Qty',
                  dataIndex: 'quantity',
                  key: 'quantity',
                  align: 'right'
                },
                {
                  title: 'Unit Rate (₹)',
                  dataIndex: 'rate',
                  key: 'rate',
                  align: 'right',
                  render: (val) => val.toFixed(2)
                },
                {
                  title: 'Amount (₹)',
                  dataIndex: 'amount',
                  key: 'amount',
                  align: 'right',
                  render: (val) => <b>{val.toFixed(2)}</b>
                }
              ]}
            />

            <Divider style={{ margin: '16px 0' }} />

            {/* Totals */}
            <Row justify="end">
              <Col span={10}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Subtotal:</span>
                    <span>₹{Number(selectedInvoice.subtotal).toLocaleString()}</span>
                  </div>
                  {selectedInvoice.gstType === 'CGST' ? (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>CGST (9%):</span>
                        <span>₹{Number(selectedInvoice.gstAmount / 2).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>SGST (9%):</span>
                        <span>₹{Number(selectedInvoice.gstAmount / 2).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    </>
                  ) : selectedInvoice.gstType === 'IGST' ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>IGST (18%):</span>
                      <span>₹{Number(selectedInvoice.gstAmount).toLocaleString()}</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Total GST (18%):</span>
                      <span>₹{Number(selectedInvoice.gstAmount).toLocaleString()}</span>
                    </div>
                  )}
                  <Divider style={{ margin: '4px 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: '#0d47a1', fontSize: '13px' }}>
                    <span>Grand Total:</span>
                    <span>₹{Number(selectedInvoice.grandTotal).toLocaleString()}</span>
                  </div>
                </div>
              </Col>
            </Row>

            <div style={{ textAlign: 'center', marginTop: '40px', fontSize: '10px', color: '#999' }}>
              Thank you for your business! Computer generated tax invoice. No signature required.
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Invoices;
