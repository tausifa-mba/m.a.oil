import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, Row, Col, message, Spin, Typography, Divider } from 'antd';
import { SaveOutlined, SettingOutlined } from '@ant-design/icons';
import api from '../services/api';

const { Title, Paragraph, Text } = Typography;

const Settings = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [previewData, setPreviewData] = useState({
    companyName: 'M.A. OIL',
    address: 'Purani Basti Road Jugsalai, Jamshedpur',
    gstin: '20AGLPM2087Q1ZY',
    stateName: 'Jharkhand',
    stateCode: '20',
    declaration: 'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.',
    authorizedSignatory: 'for M.A. Oil'
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/settings');
      if (res.success && res.data) {
        form.setFieldsValue(res.data);
        setPreviewData(res.data);
      }
    } catch (err) {
      message.error(err.message || 'Failed to fetch settings');
    } finally {
      setLoading(false);
    }
  };

  const handleValuesChange = (_, allValues) => {
    setPreviewData({
      ...previewData,
      ...allValues
    });
  };

  const onFinish = async (values) => {
    setSaveLoading(true);
    try {
      const res = await api.put('/settings', values);
      if (res.success) {
        message.success('Company settings updated successfully');
        setPreviewData(res.data);
      }
    } catch (err) {
      message.error(err.message || 'Failed to update settings');
    } finally {
      setSaveLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
        <Spin size="large" tip="Loading settings..." />
      </div>
    );
  }

  return (
    <div style={{ padding: '8px', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Premium Gradient Header Block */}
      <div style={{
        background: 'linear-gradient(135deg, #0d47a1 0%, #1565c0 100%)',
        padding: '24px 32px',
        borderRadius: '12px',
        color: '#ffffff',
        marginBottom: '24px',
        boxShadow: '0 4px 20px rgba(13, 71, 161, 0.15)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <Title level={2} style={{ color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <SettingOutlined /> Company Settings
          </Title>
          <Paragraph style={{ color: '#e3f2fd', margin: '8px 0 0 0', fontSize: '14px' }}>
            Manage details of your organization. These details will be printed on all future tax invoices and downloaded PDFs.
          </Paragraph>
        </div>
        <div style={{
          position: 'absolute',
          right: '-20px',
          bottom: '-30px',
          fontSize: '120px',
          color: 'rgba(255, 255, 255, 0.05)',
          pointerEvents: 'none',
          userSelect: 'none'
        }}>
          ⚙️
        </div>
      </div>

      <Row gutter={[24, 24]}>
        
        {/* Form Column */}
        <Col xs={24} lg={13}>
          <Card 
            title={<span style={{ fontSize: '16px', fontWeight: 600 }}>Edit Firm Details</span>}
            bordered={false}
            style={{ 
              boxShadow: '0 4px 16px rgba(0,0,0,0.04)', 
              borderRadius: '12px' 
            }}
          >
            <Form
              form={form}
              layout="vertical"
              onFinish={onFinish}
              onValuesChange={handleValuesChange}
              requiredMark="optional"
            >
              <Row gutter={16}>
                <Col span={24}>
                  <Form.Item
                    label={<span style={{ fontWeight: 500 }}>Company Name</span>}
                    name="companyName"
                    rules={[{ required: true, message: 'Please enter company name' }]}
                  >
                    <Input placeholder="e.g. M.A. OIL" size="large" />
                  </Form.Item>
                </Col>

                <Col span={24}>
                  <Form.Item
                    label={<span style={{ fontWeight: 500 }}>Address (Dispatch Location)</span>}
                    name="address"
                    rules={[{ required: true, message: 'Please enter address' }]}
                  >
                    <Input.TextArea rows={3} placeholder="Full address..." size="large" />
                  </Form.Item>
                </Col>

                <Col xs={24} sm={12}>
                  <Form.Item
                    label={<span style={{ fontWeight: 500 }}>GSTIN / UIN</span>}
                    name="gstin"
                    rules={[
                      { required: true, message: 'Please enter GSTIN' },
                      { pattern: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, message: 'Please enter a valid GST number format' }
                    ]}
                  >
                    <Input placeholder="e.g. 20AGLPM2087Q1ZY" size="large" />
                  </Form.Item>
                </Col>

                <Col xs={24} sm={12}>
                  <Form.Item
                    label={<span style={{ fontWeight: 500 }}>State Name</span>}
                    name="stateName"
                    rules={[{ required: true, message: 'Please enter State' }]}
                  >
                    <Input placeholder="e.g. Jharkhand" size="large" />
                  </Form.Item>
                </Col>

                <Col xs={24} sm={12}>
                  <Form.Item
                    label={<span style={{ fontWeight: 500 }}>State Code</span>}
                    name="stateCode"
                    rules={[{ required: true, message: 'Please enter State Code' }]}
                  >
                    <Input placeholder="e.g. 20" size="large" />
                  </Form.Item>
                </Col>

                <Col xs={24} sm={12}>
                  <Form.Item
                    label={<span style={{ fontWeight: 500 }}>Authorized Signatory Placeholder</span>}
                    name="authorizedSignatory"
                    rules={[{ required: true, message: 'Please enter authorized signatory' }]}
                  >
                    <Input placeholder="e.g. for M.A. Oil" size="large" />
                  </Form.Item>
                </Col>

                <Col span={24}>
                  <Form.Item
                    label={<span style={{ fontWeight: 500 }}>Invoice Declaration</span>}
                    name="declaration"
                    rules={[{ required: true, message: 'Please enter invoice declaration' }]}
                  >
                    <Input.TextArea rows={3} placeholder="Declaration text shown at the bottom of the invoice..." size="large" />
                  </Form.Item>
                </Col>
              </Row>

              <Divider style={{ margin: '16px 0' }} />

              <Form.Item style={{ marginBottom: 0 }}>
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  icon={<SaveOutlined />} 
                  loading={saveLoading}
                  size="large"
                  style={{ 
                    borderRadius: '8px',
                    height: '45px',
                    background: '#0d47a1',
                    boxShadow: '0 4px 12px rgba(13, 71, 161, 0.2)'
                  }}
                  block
                >
                  Save Company Settings
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        {/* Live Preview Column */}
        <Col xs={24} lg={11}>
          <Card
            title={<span style={{ fontSize: '16px', fontWeight: 600 }}>Live Invoice Header Preview</span>}
            bordered={false}
            style={{ 
              boxShadow: '0 4px 16px rgba(0,0,0,0.04)', 
              borderRadius: '12px',
              backgroundColor: '#fafafa',
              height: '100%'
            }}
          >
            <div style={{ 
              padding: '16px', 
              backgroundColor: '#ffffff', 
              border: '1.5px solid #000000', 
              borderRadius: '4px',
              fontFamily: 'Helvetica, Arial, sans-serif',
              fontSize: '11px',
              color: '#000000'
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '55% 45%' }}>
                {/* Left Header */}
                <div style={{ borderRight: '1.2px solid #000000', paddingRight: '8px', paddingBottom: '8px' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '12.5px', textTransform: 'uppercase' }}>
                    {previewData.companyName || 'M.A. OIL'}
                  </div>
                  <div style={{ marginTop: '4px', color: '#333333', fontSize: '9.5px', minHeight: '30px' }}>
                    {previewData.address || 'Address goes here...'}
                  </div>
                  <div style={{ marginTop: '8px', fontWeight: 'bold' }}>
                    GSTIN/UIN: <span style={{ fontFamily: 'monospace' }}>{previewData.gstin || 'GSTIN HERE'}</span>
                  </div>
                  <div style={{ marginTop: '2px' }}>
                    State Name: <span style={{ fontWeight: 'bold' }}>{previewData.stateName || 'State'}</span>, Code: {previewData.stateCode || '00'}
                  </div>
                </div>

                {/* Right Logistics Placeholder */}
                <div style={{ paddingLeft: '8px', fontSize: '9.5px', color: '#666666' }}>
                  <div>Invoice No.</div>
                  <div style={{ fontWeight: 'bold', color: '#000000', marginBottom: '8px' }}>INV-2026-000001</div>
                  <div>Dated</div>
                  <div style={{ fontWeight: 'bold', color: '#000000', marginBottom: '8px' }}>25-Jun-26</div>
                  <div>State code matching check:</div>
                  <Text type="secondary" style={{ fontSize: '8.5px' }}>
                    Calculates local (CGST/SGST) vs interstate (IGST) dynamically matching customer state with <strong>{previewData.stateName || 'Jharkhand'}</strong>.
                  </Text>
                </div>
              </div>

              <Divider style={{ margin: '8px 0', borderColor: '#000000' }} />

              <div style={{ fontSize: '8.5px', padding: '4px 0', borderBottom: '1px solid #000000' }}>
                <strong>Declaration Preview:</strong>
                <div style={{ fontStyle: 'italic', marginTop: '2px', color: '#444444' }}>
                  {previewData.declaration || 'Declaration text goes here...'}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '9px' }}>
                <span style={{ color: '#666' }}>Signatory Heading:</span>
                <span style={{ fontWeight: 'bold' }}>{previewData.authorizedSignatory || 'for M.A. Oil'}</span>
              </div>
            </div>
          </Card>
        </Col>

      </Row>
    </div>
  );
};

export default Settings;
