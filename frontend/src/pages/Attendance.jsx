import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Radio, DatePicker, Select, message, Tabs, Space, Spin, Tag, Row, Col } from 'antd';
import { CheckOutlined, FileTextOutlined, CalendarOutlined, SaveOutlined } from '@ant-design/icons';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import dayjs from 'dayjs';

const { Option } = Select;
const { TabPane } = Tabs;

const Attendance = () => {
  const [activeTab, setActiveTab] = useState('1');
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState(dayjs());
  const [attendanceRecords, setAttendanceRecords] = useState({}); // { [empId]: 'Present' | 'Absent' | 'Half Day' }

  // Report States
  const [reportMonth, setReportMonth] = useState(dayjs().format('YYYY-MM'));
  const [reportData, setReportData] = useState([]);
  const [reportLoading, setReportLoading] = useState(false);

  const { hasRole } = useAuth();
  const canEdit = hasRole(['Admin', 'Manager']);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const res = await api.get('/employees?limit=100&status=Active');
      if (res.success) {
        setEmployees(res.data || []);
        // Pre-fill all as 'Present' by default
        const initial = {};
        (res.data || []).forEach(emp => {
          initial[emp._id] = 'Present';
        });
        setAttendanceRecords(initial);
      }
    } catch (err) {
      message.error('Failed to load active employee roster');
    } finally {
      setLoading(false);
    }
  };

  const fetchMonthlyReport = async (monthStr) => {
    setReportLoading(true);
    try {
      const res = await api.get(`/attendance/report?month=${monthStr}`);
      if (res.success) {
        setReportData(res.report || []);
      }
    } catch (err) {
      message.error(err.message || 'Failed to load attendance report');
    } finally {
      setReportLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === '1') {
      fetchEmployees();
    } else {
      fetchMonthlyReport(reportMonth);
    }
  }, [activeTab]);

  const handleStatusChange = (employeeId, status) => {
    setAttendanceRecords({
      ...attendanceRecords,
      [employeeId]: status
    });
  };

  const handleSaveAttendance = async () => {
    try {
      const recordsArray = Object.keys(attendanceRecords).map(empId => ({
        employeeId: empId,
        status: attendanceRecords[empId]
      }));

      const res = await api.post('/attendance/bulk', {
        date: date.format('YYYY-MM-DD'),
        records: recordsArray
      });

      if (res.success) {
        message.success(`Attendance successfully logged for date: ${date.format('DD-MMM-YYYY')}`);
      }
    } catch (err) {
      message.error(err.message || 'Failed to save attendance logs');
    }
  };

  const handleMonthChange = (dateVal, dateString) => {
    setReportMonth(dateString);
    fetchMonthlyReport(dateString);
  };

  const attendanceColumns = [
    {
      title: 'Employee Code',
      dataIndex: 'employeeCode',
      key: 'employeeCode',
      render: (code) => <Tag color="orange">{code}</Tag>
    },
    {
      title: 'Employee Name',
      dataIndex: 'employeeName',
      key: 'employeeName',
      render: (text) => <b>{text}</b>
    },
    {
      title: 'Status Marking',
      key: 'marking',
      render: (_, record) => (
        <Radio.Group
          value={attendanceRecords[record._id] || 'Present'}
          onChange={(e) => handleStatusChange(record._id, e.target.value)}
          disabled={!canEdit}
        >
          <Radio.Button value="Present" style={{ backgroundColor: attendanceRecords[record._id] === 'Present' ? '#e8f5e9' : '' }}>
            Present
          </Radio.Button>
          <Radio.Button value="Half Day" style={{ backgroundColor: attendanceRecords[record._id] === 'Half Day' ? '#fff3e0' : '' }}>
            Half Day
          </Radio.Button>
          <Radio.Button value="Absent" style={{ backgroundColor: attendanceRecords[record._id] === 'Absent' ? '#ffebee' : '' }}>
            Absent
          </Radio.Button>
        </Radio.Group>
      )
    }
  ];

  return (
    <Card title="Employee Attendance Portal">
      <Tabs activeKey={activeTab} onChange={(key) => setActiveTab(key)} size="large">
        
        {/* TAB 1: DAILY ENTRY */}
        <TabPane 
          tab={
            <span>
              <CalendarOutlined /> Daily Attendance Entry
            </span>
          } 
          key="1"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h4>Mark Daily Staff Logs</h4>
                <p style={{ color: '#888', margin: 0 }}>Select date and select attendance statuses for employees.</p>
              </div>
              <Space>
                <DatePicker 
                  value={date} 
                  onChange={(d) => setDate(d || dayjs())} 
                  format="DD-MM-YYYY" 
                  allowClear={false}
                />
                {canEdit && (
                  <Button 
                    type="primary" 
                    icon={<SaveOutlined />} 
                    onClick={handleSaveAttendance}
                    style={{ fontWeight: 500 }}
                  >
                    Save Attendance
                  </Button>
                )}
              </Space>
            </div>

            <Table
              dataSource={employees}
              columns={attendanceColumns}
              rowKey="_id"
              loading={loading}
              pagination={false}
              bordered
            />
          </div>
        </TabPane>

        {/* TAB 2: MONTHLY REPORT */}
        <TabPane 
          tab={
            <span>
              <FileTextOutlined /> Attendance Summaries
            </span>
          } 
          key="2"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h4>Monthly Roster Report Summary</h4>
                <p style={{ color: '#888', margin: 0 }}>Calculates work days (Present days + Half days * 0.5)</p>
              </div>
              <Space>
                <span style={{ fontWeight: 500 }}>Select Month:</span>
                <DatePicker 
                  picker="month" 
                  value={dayjs(reportMonth, 'YYYY-MM')} 
                  onChange={handleMonthChange}
                  format="YYYY-MM" 
                  allowClear={false}
                />
              </Space>
            </div>

            <Table
              dataSource={reportData}
              rowKey="employee._id"
              loading={reportLoading}
              bordered
              columns={[
                {
                  title: 'Employee Code',
                  dataIndex: ['employee', 'employeeCode'],
                  key: 'employeeCode',
                  render: (code) => <Tag color="orange">{code}</Tag>
                },
                {
                  title: 'Name',
                  dataIndex: ['employee', 'employeeName'],
                  key: 'employeeName',
                  render: (text) => <b>{text}</b>
                },
                {
                  title: 'Full Days Present',
                  dataIndex: 'present',
                  key: 'present',
                  align: 'center',
                  render: (val) => <span style={{ color: '#1b5e20', fontWeight: 'bold' }}>{val}</span>
                },
                {
                  title: 'Half Days Present',
                  dataIndex: 'halfDay',
                  key: 'halfDay',
                  align: 'center',
                  render: (val) => <span style={{ color: '#e65100', fontWeight: '500' }}>{val}</span>
                },
                {
                  title: 'Days Absent',
                  dataIndex: 'absent',
                  key: 'absent',
                  align: 'center',
                  render: (val) => <span style={{ color: '#c62828' }}>{val}</span>
                },
                {
                  title: 'Calculated Work Days',
                  dataIndex: 'totalPresentDays',
                  key: 'totalPresentDays',
                  align: 'center',
                  render: (val) => <Tag color="success" style={{ fontSize: '12px', fontWeight: 'bold' }}>{val} Days</Tag>
                }
              ]}
            />
          </div>
        </TabPane>
      </Tabs>
    </Card>
  );
};

export default Attendance;
