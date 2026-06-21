import React, { useState, useEffect } from 'react';
import { Table, Card, Button, Form, Select, DatePicker, message, Row, Col, Space, Tag, Modal, Statistic, Input } from 'antd';
import { PlusOutlined, CreditCardOutlined, HistoryOutlined, CheckCircleOutlined } from '@ant-design/icons';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import dayjs from 'dayjs';

const { Option } = Select;

const Salaries = () => {
  const [salaries, setSalaries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  
  // Payment Modal States
  const [isPayOpen, setIsPayOpen] = useState(false);
  const [payingRecord, setPayingRecord] = useState(null);
  const [paymentForm] = Form.useForm();
  
  const [generateForm] = Form.useForm();
  const { hasRole } = useAuth();
  
  const canManage = hasRole(['Admin', 'Manager']);

  const fetchSalaries = async () => {
    setLoading(true);
    try {
      const res = await api.get('/salaries');
      if (res.success) {
        setSalaries(res.salaries || []);
      }
    } catch (err) {
      message.error(err.message || 'Failed to fetch salary records');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployeesList = async () => {
    try {
      const res = await api.get('/employees?limit=100&status=Active');
      if (res.success) {
        setEmployees(res.data || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchSalaries();
    fetchEmployeesList();
  }, []);

  const handleGenerate = async (values) => {
    try {
      const res = await api.post('/salaries/generate', {
        employeeId: values.employeeId,
        month: values.month.format('YYYY-MM')
      });
      if (res.success) {
        message.success('Salary generated successfully!');
        setIsGenerateOpen(false);
        generateForm.resetFields();
        fetchSalaries();
      }
    } catch (err) {
      message.error(err.message || 'Failed to generate salary');
    }
  };

  const openPaymentModal = (record) => {
    setPayingRecord(record);
    paymentForm.setFieldsValue({
      paymentDate: dayjs()
    });
    setIsPayOpen(true);
  };

  const handleProcessPayment = async (values) => {
    try {
      const res = await api.post(`/salaries/${payingRecord._id}/pay`, {
        paymentDate: values.paymentDate ? values.paymentDate.toDate() : new Date()
      });
      if (res.success) {
        message.success('Salary marked as Paid! Cash Book updated.');
        setIsPayOpen(false);
        setPayingRecord(null);
        fetchSalaries();
      }
    } catch (err) {
      message.error(err.message || 'Failed to process payment');
    }
  };

  const columns = [
    {
      title: 'Month',
      dataIndex: 'month',
      key: 'month',
      render: (m) => <Tag color="blue" style={{ fontWeight: 600 }}>{m}</Tag>
    },
    {
      title: 'Employee',
      dataIndex: ['employeeId', 'employeeName'],
      key: 'employeeName',
      render: (text, record) => (
        <span>
          <b>{text}</b> <br />
          <span style={{ fontSize: '11px', color: '#888' }}>
            Code: {record.employeeId?.employeeCode}
          </span>
        </span>
      )
    },
    {
      title: 'Work Days',
      dataIndex: 'presentDays',
      key: 'presentDays',
      align: 'center',
      render: (val) => `${val} Days`
    },
    {
      title: 'Computed Salary (₹)',
      dataIndex: 'salaryAmount',
      key: 'salaryAmount',
      align: 'right',
      render: (val) => <b>₹{Number(val).toLocaleString()}</b>
    },
    {
      title: 'Payment Status',
      dataIndex: 'paymentStatus',
      key: 'paymentStatus',
      render: (status, record) => (
        <Space>
          <Tag color={status === 'Paid' ? 'success' : 'warning'}>
            {status.toUpperCase()}
          </Tag>
          {status === 'Paid' && record.paymentDate && (
            <span style={{ fontSize: '11px', color: '#999' }}>
              on {new Date(record.paymentDate).toLocaleDateString()}
            </span>
          )}
        </Space>
      )
    }
  ];

  if (canManage) {
    columns.push({
      title: 'Actions',
      key: 'actions',
      render: (_, record) => {
        if (record.paymentStatus === 'Pending') {
          return (
            <Button
              type="primary"
              size="small"
              icon={<CreditCardOutlined />}
              onClick={() => openPaymentModal(record)}
            >
              Process Payout
            </Button>
          );
        }
        return <Tag color="success"><CheckCircleOutlined /> PAID</Tag>;
      }
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <Card 
        title="Salary & Payroll Registry"
        extra={
          canManage && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsGenerateOpen(true)}>
              Generate Month Salary
            </Button>
          )
        }
      >
        <Table
          dataSource={salaries}
          columns={columns}
          rowKey="_id"
          loading={loading}
          bordered
        />
      </Card>

      {/* GENERATE SALARY MODAL */}
      <Modal
        title="Compute Monthly Staff Salary"
        open={isGenerateOpen}
        onCancel={() => setIsGenerateOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form
          form={generateForm}
          layout="vertical"
          onFinish={handleGenerate}
          style={{ marginTop: '16px' }}
        >
          <Form.Item
            name="employeeId"
            label="Select Active Employee"
            rules={[{ required: true, message: 'Please select an employee!' }]}
          >
            <Select placeholder="Search and select employee" showSearch optionFilterProp="children">
              {employees.map(emp => (
                <Option key={emp._id} value={emp._id}>{emp.employeeName} ({emp.employeeCode})</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="month"
            label="Select Payroll Month"
            rules={[{ required: true, message: 'Please select month!' }]}
          >
            <DatePicker picker="month" format="YYYY-MM" style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => setIsGenerateOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit">Run Payroll calculation</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* PROCESS PAYMENT MODAL */}
      <Modal
        title="Disburse Payroll Payout"
        open={isPayOpen}
        onCancel={() => setIsPayOpen(false)}
        footer={null}
        destroyOnClose
      >
        {payingRecord && (
          <Form
            form={paymentForm}
            layout="vertical"
            onFinish={handleProcessPayment}
            style={{ marginTop: '16px' }}
          >
            <Row gutter={16} style={{ marginBottom: '20px' }}>
              <Col span={12}>
                <Statistic title="Employee" value={payingRecord.employeeId?.employeeName} valueStyle={{ fontSize: '16px', fontWeight: 'bold' }} />
              </Col>
              <Col span={12}>
                <Statistic title="Net Salary (INR)" value={payingRecord.salaryAmount} precision={2} prefix="₹" valueStyle={{ fontSize: '18px', fontWeight: 'bold', color: '#c62828' }} />
              </Col>
            </Row>

            <Form.Item
              name="paymentDate"
              label="Actual Disbursal / Payment Date"
              rules={[{ required: true, message: 'Payment date is required' }]}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 0 }}>
              <Space>
                <Button onClick={() => setIsPayOpen(false)}>Cancel</Button>
                <Button type="primary" htmlType="submit">Mark Paid & Post to Cashbook</Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
};

export default Salaries;
