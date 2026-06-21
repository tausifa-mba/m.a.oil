import React, { useState } from 'react';
import { Card, Form, Input, Button, Typography, message, Space } from 'antd';
import { MailOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const { Title, Text } = Typography;

const Login = () => {
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const user = await login(values.email, values.password);
      message.success(`Welcome back, ${user.name}!`);
      
      // Redirect based on role
      if (user.role === 'Staff') {
        navigate('/products');
      } else {
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Login error:', error);
      message.error(error.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0d47a1 0%, #1976d2 100%)',
      padding: '16px'
    }}>
      <Card style={{ 
        width: '100%', 
        maxWidth: '420px', 
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
        border: 'none'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '54px',
            height: '54px',
            borderRadius: '10px',
            backgroundColor: '#e3f2fd',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
            margin: '0 auto 12px auto'
          }}>📦</div>
          <Title level={3} style={{ margin: 0, color: '#0d47a1', fontWeight: 700 }}>
            Container Trading ERP
          </Title>
          <Text type="secondary" style={{ fontSize: '13px' }}>
            Enter credentials to access the ERP Portal
          </Text>
        </div>

        <Form
          name="login_form"
          initialValues={{ remember: true }}
          onFinish={onFinish}
          layout="vertical"
          size="large"
        >
          <Form.Item
            name="email"
            rules={[
              { required: true, message: 'Please input your email!' },
              { type: 'email', message: 'Please enter a valid email!' }
            ]}
          >
            <Input 
              prefix={<MailOutlined style={{ color: '#bfbfbf' }} />} 
              placeholder="email@containererp.com" 
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: 'Please input your password!' }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="••••••••"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: '12px' }}>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={loading} 
              block
              style={{ fontWeight: 600, height: '46px' }}
            >
              Sign In
            </Button>
          </Form.Item>

          <div style={{ textAlign: 'center' }}>
            <Text type="secondary" style={{ fontSize: '11px' }}>
              For internal usage only. Contact IT support for credentials.
            </Text>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default Login;
