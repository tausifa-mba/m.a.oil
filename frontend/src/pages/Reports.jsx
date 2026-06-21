import React, { useState, useEffect } from 'react';
import { Card, Select, Button, DatePicker, Table, Space, Divider, message, Row, Col, Alert, Tag } from 'antd';
import { FileExcelOutlined, FileTextOutlined, SearchOutlined, BarChartOutlined } from '@ant-design/icons';
import api from '../services/api';
import dayjs from 'dayjs';

const { Option } = Select;
const { RangePicker } = DatePicker;

const Reports = () => {
  const [reportType, setReportType] = useState('sales');
  
  // Filters states
  const [dateRange, setDateRange] = useState([dayjs().subtract(30, 'day'), dayjs()]);
  const [selectedPlant, setSelectedPlant] = useState(undefined);
  const [selectedCustomer, setSelectedCustomer] = useState(undefined);
  const [selectedSupplier, setSelectedSupplier] = useState(undefined);
  const [selectedMonth, setSelectedMonth] = useState(dayjs());

  // Data preview states
  const [previewData, setPreviewData] = useState([]);
  const [loading, setLoading] = useState(false);

  // Metadata dropdown dependencies
  const [plants, setPlants] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  useEffect(() => {
    const fetchDependencies = async () => {
      try {
        const [plantsRes, customersRes, suppliersRes] = await Promise.all([
          api.get('/plants?limit=100'),
          api.get('/customers?limit=100'),
          api.get('/suppliers?limit=100')
        ]);
        if (plantsRes.success) setPlants(plantsRes.data || []);
        if (customersRes.success) setCustomers(customersRes.data || []);
        if (suppliersRes.success) setSuppliers(suppliersRes.data || []);
      } catch (err) {
        console.error(err);
      }
    };
    fetchDependencies();
  }, []);

  const getQueryString = () => {
    let query = '';
    if (dateRange && dateRange[0] && dateRange[1]) {
      query += `&startDate=${dateRange[0].format('YYYY-MM-DD')}&endDate=${dateRange[1].format('YYYY-MM-DD')}`;
    }
    if (selectedPlant) query += `&plantId=${selectedPlant}`;
    if (selectedCustomer) query += `&customerId=${selectedCustomer}`;
    if (selectedSupplier) query += `&supplierId=${selectedSupplier}`;
    if (selectedMonth) query += `&month=${selectedMonth.format('YYYY-MM')}`;
    return query;
  };

  const handleFetchPreview = async () => {
    setLoading(true);
    setPreviewData([]);
    try {
      let endpoint = `/reports/${reportType}?${getQueryString()}`;
      // In reportController, ledger checks are routes /reports/customer-ledger or /reports/supplier-ledger
      if (reportType === 'customer-ledger') {
        if (!selectedCustomer) throw new Error('Please select a customer for the Ledger statement');
        endpoint = `/reports/customer-ledger?customerId=${selectedCustomer}${getQueryString()}`;
      } else if (reportType === 'supplier-ledger') {
        if (!selectedSupplier) throw new Error('Please select a supplier for the Ledger statement');
        endpoint = `/reports/supplier-ledger?supplierId=${selectedSupplier}${getQueryString()}`;
      }

      const res = await api.get(endpoint);
      if (res.success) {
        setPreviewData(res.data || []);
        message.success(`Preview updated: ${res.data?.length || 0} rows found`);
      }
    } catch (err) {
      message.error(err.message || 'Failed to fetch report preview');
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    if (reportType === 'customer-ledger' && !selectedCustomer) {
      return message.error('Please select a customer for Ledger statement export');
    }
    if (reportType === 'supplier-ledger' && !selectedSupplier) {
      return message.error('Please select a supplier for Ledger statement export');
    }

    const token = localStorage.getItem('token');
    let endpoint = reportType;
    let params = `format=excel&token=${token}${getQueryString()}`;
    
    if (reportType === 'customer-ledger') {
      params = `format=excel&token=${token}&customerId=${selectedCustomer}${getQueryString()}`;
    } else if (reportType === 'supplier-ledger') {
      params = `format=excel&token=${token}&supplierId=${selectedSupplier}${getQueryString()}`;
    }

    const downloadUrl = `${import.meta.env.VITE_API_URL || '/api'}/reports/${endpoint}?${params}`;
    window.open(downloadUrl, '_blank');
  };

  // Define table preview columns dynamically based on report type
  const getColumns = () => {
    if (previewData.length === 0) return [];
    
    // We inspect the keys of the first object to generate standard columns
    const firstObj = previewData[0];
    return Object.keys(firstObj).map(key => ({
      title: key,
      dataIndex: key,
      key: key,
      render: (val) => {
        if (typeof val === 'number') {
          // If total column or price, format nicely
          if (key.includes('Price') || key.includes('Val') || key.includes('Amt') || key.includes('Total') || key.includes('Price') || key.includes('Subtotal')) {
            return <b>₹{val.toLocaleString()}</b>;
          }
          return val;
        }
        return val;
      }
    }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <Card title={<span><BarChartOutlined /> ERP Report Analytics Center</span>}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={6}>
            <span style={{ fontWeight: 500, display: 'block', marginBottom: '8px' }}>Report Type:</span>
            <Select 
              value={reportType} 
              onChange={(val) => { setReportType(val); setPreviewData([]); }} 
              style={{ width: '100%' }}
            >
              <Option value="sales">Sales (Tax Invoices)</Option>
              <Option value="purchases">Purchases (Stock In)</Option>
              <Option value="inventory">Inventory Valuation (Plant Stock)</Option>
              <Option value="stock-movements">Plant-wise Stock Movement Report</Option>
              <Option value="lowstock">Low Stock Alerts Report</Option>
              <Option value="expenses">Expenses Ledger Report</Option>
              <Option value="salaries">Salaries & Payroll Report</Option>
              <Option value="customer-ledger">Customer Ledger Statement</Option>
              <Option value="supplier-ledger">Supplier Ledger Statement</Option>
            </Select>
          </Col>

          {/* Render filters conditionally based on report type */}
          {(reportType === 'sales' || reportType === 'purchases' || reportType === 'expenses' || reportType === 'customer-ledger' || reportType === 'supplier-ledger' || reportType === 'stock-movements') && (
            <Col xs={24} sm={8}>
              <span style={{ fontWeight: 500, display: 'block', marginBottom: '8px' }}>Date Range Filter:</span>
              <RangePicker value={dateRange} onChange={(val) => setDateRange(val)} style={{ width: '100%' }} />
            </Col>
          )}

          {reportType === 'salaries' && (
            <Col xs={24} sm={6}>
              <span style={{ fontWeight: 500, display: 'block', marginBottom: '8px' }}>Select Month:</span>
              <DatePicker picker="month" value={selectedMonth} onChange={(val) => setSelectedMonth(val || dayjs())} format="YYYY-MM" style={{ width: '100%' }} />
            </Col>
          )}

          {(reportType === 'sales' || reportType === 'purchases' || reportType === 'inventory' || reportType === 'lowstock' || reportType === 'stock-movements') && (
            <Col xs={24} sm={6}>
              <span style={{ fontWeight: 500, display: 'block', marginBottom: '8px' }}>Plant Filter:</span>
              <Select placeholder="All Plants" value={selectedPlant} onChange={setSelectedPlant} allowClear style={{ width: '100%' }}>
                {plants.map(p => (
                  <Option key={p._id} value={p._id}>{p.plantName}</Option>
                ))}
              </Select>
            </Col>
          )}

          {reportType === 'customer-ledger' && (
            <Col xs={24} sm={6}>
              <span style={{ fontWeight: 500, display: 'block', marginBottom: '8px' }}>Select Customer:</span>
              <Select placeholder="Select Customer" value={selectedCustomer} onChange={setSelectedCustomer} style={{ width: '100%' }} showSearch optionFilterProp="children">
                {customers.map(c => (
                  <Option key={c._id} value={c._id}>{c.customerName}</Option>
                ))}
              </Select>
            </Col>
          )}

          {reportType === 'supplier-ledger' && (
            <Col xs={24} sm={6}>
              <span style={{ fontWeight: 500, display: 'block', marginBottom: '8px' }}>Select Supplier:</span>
              <Select placeholder="Select Supplier" value={selectedSupplier} onChange={setSelectedSupplier} style={{ width: '100%' }} showSearch optionFilterProp="children">
                {suppliers.map(s => (
                  <Option key={s._id} value={s._id}>{s.supplierName}</Option>
                ))}
              </Select>
            </Col>
          )}

          <Col xs={24} style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
            <Space>
              <Button type="primary" icon={<SearchOutlined />} onClick={handleFetchPreview} loading={loading}>
                Generate Preview
              </Button>
              <Button type="success" icon={<FileExcelOutlined />} onClick={handleExportExcel} style={{ backgroundColor: '#1b5e20', borderColor: '#1b5e20', color: '#fff' }}>
                Download Excel Sheet
              </Button>
            </Space>
          </Col>
        </Row>

        <Divider style={{ margin: '20px 0' }} />

        <h4>Report Preview Panel</h4>
        {previewData.length > 0 ? (
          <Table
            dataSource={previewData.map((d, i) => ({ ...d, key: i }))}
            columns={getColumns()}
            bordered
            size="small"
            scroll={{ x: 'max-content' }}
          />
        ) : (
          <Alert message="Click 'Generate Preview' to load and review the report table." type="info" showIcon />
        )}
      </Card>
    </div>
  );
};

export default Reports;
