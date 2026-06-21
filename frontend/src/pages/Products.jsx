import React, { useState, useEffect, useRef } from 'react';
import { Table, Card, Button, Input, Modal, Form, Tag, message, Space, Popconfirm, Row, Col, Divider, Select, InputNumber } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, EyeOutlined, SwapOutlined } from '@ant-design/icons';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const { Option } = Select;

const Products = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(undefined);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  
  // Details Modal States
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [plantInventory, setPlantInventory] = useState([]);
  const [invLoading, setInvLoading] = useState(false);

  // Stock Adjustment Modal States
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [adjustForm] = Form.useForm();
  const [plantsList, setPlantsList] = useState([]);

  const [form] = Form.useForm();
  const { hasRole } = useAuth();
  const canvasRef = useRef(null);

  const canEdit = hasRole(['Admin', 'Manager']);
  const isAdmin = hasRole(['Admin']);

  const categories = [
    'Plastic Drums',
    'Plastic Barrels',
    'Iron Drums',
    'Water Storage Barrels',
    'Chemical Containers',
    'Lubricants',
    'Grease Products'
  ];

  const fetchProducts = async (page = 1, searchQuery = '', catQuery = undefined) => {
    setLoading(true);
    try {
      let url = `/products?page=${page}&limit=${pagination.pageSize}&search=${searchQuery}`;
      if (catQuery) url += `&category=${catQuery}`;
      
      const res = await api.get(url);
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
      message.error(err.message || 'Failed to fetch products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts(1, search, category);
  }, []);

  const handleTableChange = (pag) => {
    fetchProducts(pag.current, search, category);
  };

  const handleSearch = (val) => {
    setSearch(val);
    fetchProducts(1, val, category);
  };

  const handleCategoryFilter = (val) => {
    setCategory(val);
    fetchProducts(1, search, val);
  };

  const openAddModal = () => {
    setEditingProduct(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const openEditModal = (prod) => {
    setEditingProduct(prod);
    form.setFieldsValue(prod);
    setIsModalOpen(true);
  };

  const handleCancel = () => {
    setIsModalOpen(false);
    form.resetFields();
  };

  const handleSubmit = async (values) => {
    try {
      if (editingProduct) {
        const res = await api.put(`/products/${editingProduct._id}`, values);
        if (res.success) {
          message.success('Product updated successfully');
          fetchProducts(pagination.current, search, category);
          setIsModalOpen(false);
        }
      } else {
        const res = await api.post('/products', values);
        if (res.success) {
          message.success('Product created successfully');
          fetchProducts(1, search, category);
          setIsModalOpen(false);
        }
      }
    } catch (err) {
      message.error(err.message || 'Action failed');
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await api.delete(`/products/${id}`);
      if (res.success) {
        message.success('Product deleted successfully');
        fetchProducts(1, search, category);
      }
    } catch (err) {
      message.error(err.message || 'Failed to delete product');
    }
  };

  // Details drawer / Modal loading
  const openDetails = async (prod) => {
    setSelectedProduct(prod);
    setIsDetailsOpen(true);
    setInvLoading(true);
    try {
      const res = await api.get(`/products/${prod._id}/inventory`);
      if (res.success) {
        setPlantInventory(res.stock || []);
      }
    } catch (err) {
      message.error('Failed to load plant stock details');
    } finally {
      setInvLoading(false);
    }
  };

  // Draw barcode on details modal render
  useEffect(() => {
    if (selectedProduct && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const code = selectedProduct.productCode || 'PRODUCT';
      ctx.fillStyle = '#000000';
      
      let startX = 20;
      for (let i = 0; i < code.length; i++) {
        const charCode = code.charCodeAt(i);
        const binary = charCode.toString(2).padStart(8, '0');
        for (let b = 0; b < binary.length; b++) {
          const barWidth = binary[b] === '1' ? 3 : 1;
          ctx.fillRect(startX, 10, barWidth, 40);
          startX += barWidth + 1.5;
        }
      }
      
      ctx.font = '11px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText(code, canvas.width / 2, 62);
    }
  }, [selectedProduct, isDetailsOpen]);

  // Adjust Stock modal
  const openAdjustStock = async () => {
    setIsAdjustOpen(true);
    adjustForm.setFieldsValue({
      productId: selectedProduct._id,
      productName: selectedProduct.productName
    });
    try {
      const res = await api.get('/plants');
      if (res.success) {
        setPlantsList(res.data || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAdjustSubmit = async (values) => {
    try {
      const res = await api.put('/products/inventory/adjust', {
        productId: selectedProduct._id,
        plantId: values.plantId,
        newQuantity: values.newQuantity,
        remarks: values.remarks
      });
      if (res.success) {
        message.success('Inventory stock level adjusted');
        setIsAdjustOpen(false);
        adjustForm.resetFields();
        // Refresh details stock
        openDetails(selectedProduct);
      }
    } catch (err) {
      message.error(err.message || 'Stock adjustment failed');
    }
  };

  const columns = [
    {
      title: 'Product Code',
      dataIndex: 'productCode',
      key: 'productCode',
      render: (text) => <Tag color="geekblue" style={{ fontWeight: 600 }}>{text}</Tag>
    },
    {
      title: 'Name',
      dataIndex: 'productName',
      key: 'productName',
      render: (text) => <b style={{ color: '#0d47a1' }}>{text}</b>
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category'
    },
    {
      title: 'Specifications',
      key: 'specs',
      render: (_, record) => (
        <span style={{ fontSize: '12px', color: '#666' }}>
          {record.capacity} | {record.materialType}
        </span>
      )
    },
    {
      title: 'Purchase (₹)',
      dataIndex: 'purchasePrice',
      key: 'purchasePrice',
      align: 'right',
      render: (val) => val.toFixed(2)
    },
    {
      title: 'Selling (₹)',
      dataIndex: 'sellingPrice',
      key: 'sellingPrice',
      align: 'right',
      render: (val) => <b>{val.toFixed(2)}</b>
    },
    {
      title: 'Min Stock Limit',
      dataIndex: 'minimumStock',
      key: 'minimumStock',
      align: 'center',
      render: (val, record) => <Tag color="orange">{val} {record.unit}</Tag>
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space size="middle">
          <Button 
            type="text" 
            icon={<EyeOutlined style={{ color: '#0d47a1' }} />} 
            onClick={() => openDetails(record)} 
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
              title="Delete Product?"
              description="This will delete product master and all matching stock entries."
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
      title="Product Master Directory" 
      extra={
        canEdit && (
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={openAddModal}
            style={{ fontWeight: 500 }}
          >
            Add New Product
          </Button>
        )
      }
    >
      {/* Search and Filter */}
      <div style={{ marginBottom: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <Input
          placeholder="Search Code, Name, Desc..."
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
          value={category}
          onChange={handleCategoryFilter}
        >
          {categories.map(cat => (
            <Option key={cat} value={cat}>{cat}</Option>
          ))}
        </Select>
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
        title={editingProduct ? "Edit Product Specifications" : "Register Product Master"}
        open={isModalOpen}
        onCancel={handleCancel}
        footer={null}
        destroyOnClose
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{ unit: 'Nos', minimumStock: 10, hsnCode: '72042590' }}
          style={{ marginTop: '16px' }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="productCode"
                label="Product Code"
                rules={[{ required: true, message: 'Please input product code!' }]}
              >
                <Input placeholder="e.g. PD-PL-210L" disabled={!!editingProduct} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="productName"
                label="Product Name"
                rules={[{ required: true, message: 'Please input name!' }]}
              >
                <Input placeholder="e.g. Plastic Barrel 210L" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="category"
                label="Category"
                rules={[{ required: true, message: 'Please select category!' }]}
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
                name="unit"
                label="Counting Unit"
                rules={[{ required: true }]}
              >
                <Select>
                  <Option value="Nos">Nos (Count)</Option>
                  <Option value="Pails">Pails</Option>
                  <Option value="Buckets">Buckets</Option>
                  <Option value="Litres">Litres</Option>
                  <Option value="Kgs">Kgs</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="materialType"
                label="Material Type"
                rules={[{ required: true, message: 'Please input material!' }]}
              >
                <Input placeholder="e.g. HDPE Plastic, Galvanized Metal" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="capacity"
                label="Container Capacity"
                rules={[{ required: true, message: 'Please input capacity!' }]}
              >
                <Input placeholder="e.g. 210 Litres, 25 kg" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="purchasePrice"
                label="Purchase Price (₹)"
                rules={[{ required: true, message: 'Required' }]}
              >
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="sellingPrice"
                label="Selling Price (₹)"
                rules={[{ required: true, message: 'Required' }]}
              >
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="minimumStock"
                label="Min Stock Limit"
                rules={[{ required: true, message: 'Required' }]}
              >
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="hsnCode"
                label="HSN/SAC Code"
                rules={[{ required: true, message: 'Please input HSN/SAC code!' }]}
              >
                <Input placeholder="e.g. 72042590" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="barcode" label="Barcode ID">
                <Input placeholder="e.g. EAN13 numeric code" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="Product Description">
            <Input.TextArea rows={2} placeholder="Optional detailed specs..." />
          </Form.Item>

          <Form.Item style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 0 }}>
            <Space>
              <Button onClick={handleCancel}>Cancel</Button>
              <Button type="primary" htmlType="submit">Submit</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* DETAIL VIEW MODAL */}
      <Modal
        title="Product Inventory Details"
        open={isDetailsOpen}
        onCancel={() => setIsDetailsOpen(false)}
        footer={[
          canEdit && (
            <Button key="adjust" type="primary" icon={<SwapOutlined />} onClick={openAdjustStock}>
              Adjust Inventory Stock
            </Button>
          ),
          <Button key="close" onClick={() => setIsDetailsOpen(false)}>Close</Button>
        ]}
        width={650}
        destroyOnClose
      >
        {selectedProduct && (
          <div>
            <Row gutter={16} align="middle">
              <Col span={14}>
                <h3>{selectedProduct.productName}</h3>
                <p><b>Category:</b> {selectedProduct.category}</p>
                <p><b>Specs:</b> {selectedProduct.capacity} | {selectedProduct.materialType}</p>
                <p><b>HSN Code:</b> {selectedProduct.hsnCode || 'N/A'}</p>
                <p><b>Prices:</b> Buy: ₹{selectedProduct.purchasePrice} | Sell: ₹{selectedProduct.sellingPrice}</p>
                <p><b>Min Limit:</b> {selectedProduct.minimumStock} {selectedProduct.unit}</p>
              </Col>
              <Col span={10} style={{ textAlign: 'center' }}>
                {/* Custom canvas barcode rendering */}
                <canvas 
                  ref={canvasRef} 
                  width={220} 
                  height={80} 
                  style={{ border: '1px solid #f0f0f0', borderRadius: '4px', backgroundColor: '#fafafa' }} 
                />
              </Col>
            </Row>

            <Divider style={{ margin: '16px 0' }} />
            
            <h4>Plant-wise Inventory Summary</h4>
            <Table
              dataSource={plantInventory}
              rowKey="plantId._id"
              loading={invLoading}
              pagination={false}
              size="small"
              bordered
              columns={[
                {
                  title: 'Plant Name',
                  dataIndex: ['plantId', 'plantName'],
                  key: 'plantName'
                },
                {
                  title: 'Plant Code',
                  dataIndex: ['plantId', 'plantCode'],
                  key: 'plantCode',
                  render: (code) => <Tag color="blue">{code}</Tag>
                },
                {
                  title: 'Physical Qty',
                  dataIndex: 'quantity',
                  key: 'quantity',
                  align: 'right'
                },
                {
                  title: 'Reserved',
                  dataIndex: 'reservedQuantity',
                  key: 'reservedQuantity',
                  align: 'right'
                },
                {
                  title: 'Available Stock',
                  dataIndex: 'availableQuantity',
                  key: 'availableQuantity',
                  align: 'right',
                  render: (val, record) => {
                    const low = val <= selectedProduct.minimumStock;
                    return (
                      <span style={{ fontWeight: 'bold', color: low ? '#e65100' : '#1b5e20' }}>
                        {val} {selectedProduct.unit} {low && <Tag color="warning" style={{ fontSize: '9px', marginLeft: '5px' }}>LOW</Tag>}
                      </span>
                    );
                  }
                }
              ]}
            />
          </div>
        )}
      </Modal>

      {/* STOCK ADJUSTMENT MODAL */}
      <Modal
        title="Manual Stock Override Adjustment"
        open={isAdjustOpen}
        onCancel={() => setIsAdjustOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form
          form={adjustForm}
          layout="vertical"
          onFinish={handleAdjustSubmit}
          style={{ marginTop: '16px' }}
        >
          <Form.Item name="productName" label="Adjusting Product">
            <Input disabled />
          </Form.Item>

          <Form.Item
            name="plantId"
            label="Target Plant"
            rules={[{ required: true, message: 'Please select a plant' }]}
          >
            <Select placeholder="Select Plant Location">
              {plantsList.map(pl => (
                <Option key={pl._id} value={pl._id}>{pl.plantName} ({pl.plantCode})</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="newQuantity"
            label="New Stock Count"
            rules={[{ required: true, message: 'Please enter new quantity count' }]}
          >
            <InputNumber min={0} style={{ width: '100%' }} placeholder="Enter exact physical quantity..." />
          </Form.Item>

          <Form.Item
            name="remarks"
            label="Adjustment Remarks/Reason"
            rules={[{ required: true, message: 'Please state the reason for adjustment' }]}
          >
            <Input.TextArea placeholder="e.g. Audit mismatch, Spillage leakage, damage write-off..." />
          </Form.Item>

          <Form.Item style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => setIsAdjustOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit">Save Adjustment</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default Products;
