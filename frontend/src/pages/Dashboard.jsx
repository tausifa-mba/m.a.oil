import React, { useState, useEffect } from 'react';
import { Card, Col, Row, Statistic, Select, Spin, Alert, Table, Badge, Typography, Space } from 'antd';
import {
  ArrowUpOutlined,
  ShoppingOutlined,
  DatabaseOutlined,
  WarningOutlined,
  UserOutlined,
  CreditCardOutlined
} from '@ant-design/icons';
import api from '../services/api';

const { Option } = Select;
const { Title, Text } = Typography;

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [plants, setPlants] = useState([]);
  const [selectedPlant, setSelectedPlant] = useState(undefined);

  useEffect(() => {
    // Fetch plants list for filter
    const fetchPlants = async () => {
      try {
        const res = await api.get('/plants');
        if (res.success) {
          setPlants(res.data || []);
        }
      } catch (err) {
        console.error('Error fetching plants list:', err);
      }
    };
    fetchPlants();
  }, []);

  const fetchDashboardData = async (plantId) => {
    setLoading(true);
    setError(null);
    try {
      const url = plantId ? `/dashboard?plantId=${plantId}` : '/dashboard';
      const res = await api.get(url);
      if (res.success) {
        setData(res);
      } else {
        throw new Error(res.message || 'Failed to fetch dashboard metrics');
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData(selectedPlant);
  }, [selectedPlant]);

  if (loading && !data) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" tip="Loading Dashboard Data..." />
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        message="Dashboard Error"
        description={error}
        type="error"
        showIcon
        action={<a onClick={() => fetchDashboardData(selectedPlant)}>Retry</a>}
      />
    );
  }

  const { metrics, plantWiseStock, plantWiseValue, plantWiseLowStock, monthlySalesChart, categoryDistribution } = data;

  // Custom SVG Chart rendering for safety and premium visual appeal
  const maxChartVal = Math.max(...monthlySalesChart.map(d => Math.max(d.sales, d.purchases, 10000)));

  // SVG Area Chart parameters
  const svgWidth = 600;
  const svgHeight = 240;
  const paddingX = 40;
  const paddingY = 30;

  const pointsSales = monthlySalesChart.map((d, index) => {
    const x = paddingX + (index * (svgWidth - paddingX * 2)) / 11;
    const y = svgHeight - paddingY - (d.sales * (svgHeight - paddingY * 2)) / maxChartVal;
    return { x, y, val: d.sales, month: d.month };
  });

  const pointsPurchases = monthlySalesChart.map((d, index) => {
    const x = paddingX + (index * (svgWidth - paddingX * 2)) / 11;
    const y = svgHeight - paddingY - (d.purchases * (svgHeight - paddingY * 2)) / maxChartVal;
    return { x, y, val: d.purchases, month: d.month };
  });

  const salesPath = pointsSales.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const salesAreaPath = salesPath ? `${salesPath} L ${pointsSales[pointsSales.length - 1].x} ${svgHeight - paddingY} L ${pointsSales[0].x} ${svgHeight - paddingY} Z` : '';

  const purchasesPath = pointsPurchases.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const purchasesAreaPath = purchasesPath ? `${purchasesPath} L ${pointsPurchases[pointsPurchases.length - 1].x} ${svgHeight - paddingY} L ${pointsPurchases[0].x} ${svgHeight - paddingY} Z` : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Business Overview & Analytics</Title>
          <Text type="secondary">Real-time indicators across plants and logistics ledgers</Text>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Text style={{ fontWeight: 500 }}>Select Plant:</Text>
          <Select
            allowClear
            placeholder="All Plants"
            style={{ width: 200 }}
            value={selectedPlant}
            onChange={(val) => setSelectedPlant(val)}
          >
            {plants.map((pl) => (
              <Option key={pl._id} value={pl._id}>{pl.plantName} ({pl.plantCode})</Option>
            ))}
          </Select>
        </div>
      </div>

      {/* Metrics Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={4}>
          <Card className="metric-card">
            <Statistic
              title="Today's Sales"
              value={metrics.todaySales}
              precision={2}
              valueStyle={{ color: '#0d47a1', fontSize: '20px', fontWeight: 700 }}
              prefix="₹"
              suffix={<ArrowUpOutlined style={{ fontSize: '12px', color: '#1b5e20' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card className="metric-card">
            <Statistic
              title="Today's Purchases"
              value={metrics.todayPurchases}
              precision={2}
              valueStyle={{ color: '#c62828', fontSize: '20px', fontWeight: 700 }}
              prefix="₹"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card className="metric-card">
            <Statistic
              title="Available Stock Count"
              value={metrics.totalCompanyStock}
              valueStyle={{ color: '#1b5e20', fontSize: '20px', fontWeight: 700 }}
              prefix={<DatabaseOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card className="metric-card">
            <Statistic
              title="Low Stock Alerts"
              value={metrics.lowStockCount}
              valueStyle={{ color: '#e65100', fontSize: '20px', fontWeight: 700 }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card className="metric-card">
            <Statistic
              title="Total Clients"
              value={metrics.totalCustomers}
              valueStyle={{ color: '#006064', fontSize: '20px', fontWeight: 700 }}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card className="metric-card">
            <Statistic
              title="Pending Payments"
              value={metrics.pendingPayments}
              precision={2}
              valueStyle={{ color: '#4a148c', fontSize: '20px', fontWeight: 700 }}
              prefix="₹"
              suffix={<CreditCardOutlined style={{ fontSize: '12px' }} />}
            />
          </Card>
        </Col>
      </Row>

      {/* Charts section */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card title="Monthly Sales vs Purchases (INR)" style={{ height: '100%' }}>
            <div style={{ width: '100%', overflowX: 'auto' }}>
              <svg width="100%" height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ minWidth: '450px' }}>
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0d47a1" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#0d47a1" stopOpacity="0.0" />
                  </linearGradient>
                  <linearGradient id="purchaseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#c62828" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#c62828" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Grid Lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
                  const y = paddingY + ratio * (svgHeight - paddingY * 2);
                  return (
                    <g key={index}>
                      <line 
                        x1={paddingX} 
                        y1={y} 
                        x2={svgWidth - paddingX} 
                        y2={y} 
                        stroke="#eef2f6" 
                        strokeWidth="1" 
                      />
                      <text 
                        x={paddingX - 8} 
                        y={y + 4} 
                        fill="#999" 
                        fontSize="8px" 
                        textAnchor="end"
                      >
                        {Math.round((1 - ratio) * maxChartVal / 1000)}k
                      </text>
                    </g>
                  );
                })}

                {/* X Axis Months */}
                {pointsSales.map((p, i) => (
                  <text 
                    key={i} 
                    x={p.x} 
                    y={svgHeight - 10} 
                    fill="#666" 
                    fontSize="9px" 
                    textAnchor="middle"
                  >
                    {p.month}
                  </text>
                ))}

                {/* Render Areas */}
                {salesAreaPath && <path d={salesAreaPath} fill="url(#salesGrad)" />}
                {purchasesAreaPath && <path d={purchasesAreaPath} fill="url(#purchaseGrad)" />}

                {/* Render Polylines */}
                {salesPath && (
                  <path 
                    d={salesPath} 
                    fill="none" 
                    stroke="#0d47a1" 
                    strokeWidth="2.5" 
                  />
                )}
                {purchasesPath && (
                  <path 
                    d={purchasesPath} 
                    fill="none" 
                    stroke="#c62828" 
                    strokeWidth="2" 
                    strokeDasharray="4 2" 
                  />
                )}

                {/* Render Dots */}
                {pointsSales.map((p, i) => (
                  <circle 
                    key={i} 
                    cx={p.x} 
                    cy={p.y} 
                    r="3.5" 
                    fill="#0d47a1" 
                    stroke="#ffffff" 
                    strokeWidth="1.5" 
                  />
                ))}
                {pointsPurchases.map((p, i) => (
                  <circle 
                    key={i} 
                    cx={p.x} 
                    cy={p.y} 
                    r="3" 
                    fill="#c62828" 
                    stroke="#ffffff" 
                    strokeWidth="1.5" 
                  />
                ))}
              </svg>
            </div>
            
            {/* Chart Legend */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '10px' }}>
              <Space>
                <div style={{ width: '12px', height: '12px', backgroundColor: '#0d47a1', borderRadius: '3px' }} />
                <Text style={{ fontSize: '12px' }}>Sales (Grand Total)</Text>
              </Space>
              <Space>
                <div style={{ width: '12px', height: '12px', backgroundColor: '#c62828', borderRadius: '3px' }} />
                <Text style={{ fontSize: '12px' }}>Purchases (Cost)</Text>
              </Space>
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="Category Distribution (Stock Qty)" style={{ height: '100%' }}>
            {categoryDistribution.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>No stock available to distribute</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', padding: '10px 0' }}>
                {categoryDistribution.map((cat, index) => {
                  const totalSum = categoryDistribution.reduce((sum, item) => sum + item.value, 0);
                  const pct = totalSum > 0 ? Math.round((cat.value / totalSum) * 100) : 0;
                  
                  // Harmonic colors
                  const colors = ['#0d47a1', '#1976d2', '#2196f3', '#0097a7', '#00bcd4', '#80deea'];
                  const themeColor = colors[index % colors.length];

                  return (
                    <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                        <Text style={{ fontWeight: 500 }}>{cat.type}</Text>
                        <Text style={{ fontWeight: 600 }}>{cat.value} Nos ({pct}%)</Text>
                      </div>
                      <div style={{ width: '100%', height: '8px', backgroundColor: '#eef2f6', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', backgroundColor: themeColor, borderRadius: '4px' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Plant Table section */}
      <Row gutter={[16, 16]}>
        <Col xs={24}>
          <Card title="Plant-wise Stocks & Value Ledger">
            <Table
              dataSource={plantWiseStock.map((item, idx) => ({
                key: idx,
                plantName: item.plantName,
                plantCode: item.plantCode,
                stock: item.stock,
                value: plantWiseValue.find(v => v.plantName === item.plantName)?.value || 0,
                lowStock: plantWiseLowStock.find(l => l.plantName === item.plantName)?.count || 0
              }))}
              pagination={false}
              bordered
              columns={[
                {
                  title: 'Plant Name',
                  dataIndex: 'plantName',
                  key: 'plantName',
                  render: (text, record) => <span>{text} <b>({record.plantCode})</b></span>
                },
                {
                  title: 'Total Stock Available',
                  dataIndex: 'stock',
                  key: 'stock',
                  align: 'right',
                  render: (val) => <b>{val} Nos</b>
                },
                {
                  title: 'Total Stock Valuation (INR)',
                  dataIndex: 'value',
                  key: 'value',
                  align: 'right',
                  render: (val) => <b>₹{Number(val).toLocaleString()}</b>
                },
                {
                  title: 'Low Stock Products count',
                  dataIndex: 'lowStock',
                  key: 'lowStock',
                  align: 'center',
                  render: (val) => (
                    <Badge 
                      count={val} 
                      style={{ backgroundColor: val > 0 ? '#e65100' : '#1b5e20' }} 
                    />
                  )
                }
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
