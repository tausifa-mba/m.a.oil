import React, { useState, useEffect } from 'react';
import { Card, Table, DatePicker, Row, Col, Statistic, Spin, Space, Button, Divider, message } from 'antd';
import { BookOutlined, CalendarOutlined, FileTextOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import api from '../services/api';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

const CashBook = () => {
  const [todayBook, setTodayBook] = useState(null);
  const [todayLoading, setTodayLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [dateBook, setDateBook] = useState(null);
  const [dateLoading, setDateLoading] = useState(false);

  // Range report states
  const [range, setRange] = useState([dayjs().subtract(7, 'day'), dayjs()]);
  const [reportData, setReportData] = useState([]);
  const [reportLoading, setReportLoading] = useState(false);

  const fetchTodayCashBook = async () => {
    setTodayLoading(true);
    try {
      const res = await api.get('/cashbook');
      if (res.success) {
        setTodayBook(res.cashBook);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTodayLoading(false);
    }
  };

  const fetchDateCashBook = async (d) => {
    setDateLoading(true);
    try {
      const dateStr = d.format('YYYY-MM-DD');
      const res = await api.get(`/cashbook?date=${dateStr}`);
      if (res.success) {
        setDateBook(res.cashBook);
      }
    } catch (err) {
      message.error('Failed to load cashbook for the selected date');
    } finally {
      setDateLoading(false);
    }
  };

  const fetchRangeReport = async (rng) => {
    if (!rng || rng.length !== 2) return;
    setReportLoading(true);
    try {
      const start = rng[0].format('YYYY-MM-DD');
      const end = rng[1].format('YYYY-MM-DD');
      const res = await api.get(`/cashbook/report?startDate=${start}&endDate=${end}`);
      if (res.success) {
        setReportData(res.report || []);
      }
    } catch (err) {
      message.error(err.message || 'Failed to fetch cash flow ledger list');
    } finally {
      setReportLoading(false);
    }
  };

  useEffect(() => {
    fetchTodayCashBook();
    fetchDateCashBook(selectedDate);
    fetchRangeReport(range);
  }, []);

  const handleDateChange = (val) => {
    const d = val || dayjs();
    setSelectedDate(d);
    fetchDateCashBook(d);
  };

  const handleRangeChange = (val) => {
    setRange(val);
    fetchRangeReport(val);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. Today's Dashboard summary */}
      <Card title={<span><BookOutlined /> Today's Cash Flow Reconciliation</span>}>
        {todayLoading ? (
          <Spin />
        ) : todayBook ? (
          <Row gutter={16}>
            <Col xs={24} sm={6}>
              <Statistic 
                title="Opening Balance" 
                value={todayBook.openingBalance} 
                precision={2} 
                prefix="₹" 
                valueStyle={{ color: '#0d47a1', fontWeight: 'bold' }} 
              />
            </Col>
            <Col xs={24} sm={6}>
              <Statistic 
                title="Total Income Recd" 
                value={todayBook.income} 
                precision={2} 
                prefix="₹" 
                valueStyle={{ color: '#1b5e20', fontWeight: 'bold' }} 
                suffix={<ArrowUpOutlined style={{ fontSize: '12px', color: '#1b5e20' }} />}
              />
            </Col>
            <Col xs={24} sm={6}>
              <Statistic 
                title="Total Expenses Paid" 
                value={todayBook.expenses} 
                precision={2} 
                prefix="₹" 
                valueStyle={{ color: '#c62828', fontWeight: 'bold' }} 
                suffix={<ArrowDownOutlined style={{ fontSize: '12px', color: '#c62828' }} />}
              />
            </Col>
            <Col xs={24} sm={6}>
              <Statistic 
                title="Closing Balance" 
                value={todayBook.closingBalance} 
                precision={2} 
                prefix="₹" 
                valueStyle={{ color: '#1a237e', fontWeight: 'bold' }} 
              />
            </Col>
          </Row>
        ) : (
          <p>No cash book entry configured for today.</p>
        )}
      </Card>

      <Row gutter={16}>
        {/* 2. Specific Date Audit */}
        <Col xs={24} md={10}>
          <Card title={<span><CalendarOutlined /> Daily Cash Book Audit Lookup</span>} style={{ height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <span style={{ fontWeight: 500 }}>Audit Date:</span>
              <DatePicker value={selectedDate} onChange={handleDateChange} format="DD-MM-YYYY" allowClear={false} />
            </div>

            {dateLoading ? (
              <Spin />
            ) : dateBook ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Opening Cash:</span>
                  <b>₹{Number(dateBook.openingBalance).toFixed(2)}</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#1b5e20' }}>
                  <span>(+) Inward Income:</span>
                  <b>₹{Number(dateBook.income).toFixed(2)}</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#c62828' }}>
                  <span>(-) Outward Expense:</span>
                  <b>₹{Number(dateBook.expenses).toFixed(2)}</b>
                </div>
                <Divider style={{ margin: '8px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#0d47a1' }}>
                  <span>Closing Balance:</span>
                  <b>₹{Number(dateBook.closingBalance).toFixed(2)}</b>
                </div>
              </div>
            ) : (
              <p>No cash book logs for selected date.</p>
            )}
          </Card>
        </Col>

        {/* 3. Range analysis */}
        <Col xs={24} md={14}>
          <Card title={<span><FileTextOutlined /> Historical Balance Statement Ledger</span>} style={{ height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 500 }}>Select Range:</span>
              <RangePicker value={range} onChange={handleRangeChange} format="DD-MM-YYYY" allowClear={false} />
            </div>

            <Table
              dataSource={reportData}
              rowKey="_id"
              loading={reportLoading}
              size="small"
              bordered
              pagination={{ pageSize: 5 }}
              columns={[
                {
                  title: 'Date',
                  dataIndex: 'date',
                  key: 'date',
                  render: (date) => new Date(date).toLocaleDateString()
                },
                {
                  title: 'Opening (₹)',
                  dataIndex: 'openingBalance',
                  key: 'openingBalance',
                  align: 'right',
                  render: (v) => v.toFixed(2)
                },
                {
                  title: 'Income (₹)',
                  dataIndex: 'income',
                  key: 'income',
                  align: 'right',
                  render: (v) => <span style={{ color: '#1b5e20' }}>{v > 0 ? `+${v.toFixed(2)}` : '0.00'}</span>
                },
                {
                  title: 'Expenses (₹)',
                  dataIndex: 'expenses',
                  key: 'expenses',
                  align: 'right',
                  render: (v) => <span style={{ color: '#c62828' }}>{v > 0 ? `-${v.toFixed(2)}` : '0.00'}</span>
                },
                {
                  title: 'Closing Balance (₹)',
                  dataIndex: 'closingBalance',
                  key: 'closingBalance',
                  align: 'right',
                  render: (v) => <b>{v.toFixed(2)}</b>
                }
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default CashBook;
