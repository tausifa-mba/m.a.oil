import React, { useState } from 'react';
import { Layout, Menu, Button, Avatar, Tag, Space, Drawer } from 'antd';
import {
  MenuUnfoldOutlined,
  MenuFoldOutlined,
  DashboardOutlined,
  HomeOutlined,
  ContainerOutlined,
  SwapOutlined,
  ImportOutlined,
  FileTextOutlined,
  TeamOutlined,
  CheckSquareOutlined,
  DollarOutlined,
  WalletOutlined,
  BookOutlined,
  BarChartOutlined,
  LogoutOutlined,
  UserOutlined,
  ShopOutlined,
  SettingOutlined,
  CreditCardOutlined
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const { Header, Sider, Content } = Layout;

const AppLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileVisible, setMobileVisible] = useState(false);
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const getMenuKeys = () => {
    return [location.pathname];
  };

  // Define Menu Items based on Role
  const menuItems = [];

  if (hasRole(['Admin', 'Manager'])) {
    menuItems.push({
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
    });
  }

  menuItems.push(
    {
      key: '/plants',
      icon: <HomeOutlined />,
      label: 'Plants/Warehouses',
    },
    {
      key: '/products',
      icon: <ContainerOutlined />,
      label: 'Products Master',
    },
    {
      key: '/purchases',
      icon: <ImportOutlined />,
      label: 'Stock In (Purchases)',
    },
    {
      key: '/transfers',
      icon: <SwapOutlined />,
      label: 'Stock Transfers',
    },
    {
      key: '/invoices',
      icon: <FileTextOutlined />,
      label: 'GST Invoices',
    },
    {
      key: '/credits',
      icon: <CreditCardOutlined />,
      label: 'Credit Orders',
    },
    {
      key: '/customers',
      icon: <UserOutlined />,
      label: 'Customers',
    },
    {
      key: '/suppliers',
      icon: <ShopOutlined />,
      label: 'Suppliers',
    }
  );

  menuItems.push(
    {
      key: '/employees',
      icon: <TeamOutlined />,
      label: 'Employee Directory',
    },
    {
      key: '/attendance',
      icon: <CheckSquareOutlined />,
      label: 'Attendance Sheet',
    },
    {
      key: '/salaries',
      icon: <DollarOutlined />,
      label: 'Salary & Payroll',
    }
  );

  menuItems.push(
    {
      key: '/expenses',
      icon: <WalletOutlined />,
      label: 'Expenses Ledger',
    },
    {
      key: '/cashbook',
      icon: <BookOutlined />,
      label: 'Cash Book Sheet',
    }
  );

  if (hasRole(['Admin', 'Manager'])) {
    menuItems.push(
      {
        key: '/reports',
        icon: <BarChartOutlined />,
        label: 'Reports Center',
      },
      {
        key: '/settings',
        icon: <SettingOutlined />,
        label: 'Company Settings',
      }
    );
  }

  const handleMenuClick = (info) => {
    navigate(info.key);
    setMobileVisible(false);
  };

  const getRoleTagColor = (role) => {
    if (role === 'Admin') return '#d50000';
    if (role === 'Manager') return '#e65100';
    return '#1b5e20';
  };

  const sidebarContent = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ 
        height: '64px', 
        padding: '16px', 
        display: 'flex', 
        alignItems: 'center', 
        gap: '10px',
        borderBottom: '1px solid #f0f2f5' 
      }}>
        <div style={{ 
          width: '32px', 
          height: '32px', 
          borderRadius: '6px', 
          backgroundColor: '#0d47a1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          fontWeight: 'bold',
          fontSize: '18px'
        }}>📦</div>
        {!collapsed && <span style={{ fontWeight: '700', fontSize: '15px', color: '#0d47a1', letterSpacing: '0.5px' }}>CONTAINER ERP</span>}
      </div>
      <Menu
        mode="inline"
        selectedKeys={getMenuKeys()}
        items={menuItems}
        onClick={handleMenuClick}
        style={{ borderRight: 0, flex: 1, padding: '8px 0' }}
      />
      <div style={{ padding: '16px', borderTop: '1px solid #f0f2f5', display: 'flex', justifyContent: 'center' }}>
        {!collapsed ? (
          <Button type="primary" danger icon={<LogoutOutlined />} onClick={logout} block>
            Logout
          </Button>
        ) : (
          <Button type="primary" danger icon={<LogoutOutlined />} onClick={logout} shape="circle" />
        )}
      </div>
    </div>
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* Sider for Desktop */}
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        theme="light"
        width={250}
        style={{
          boxShadow: '2px 0 8px rgba(0, 0, 0, 0.05)',
          zIndex: 10,
          display: 'none'
        }}
        className="desktop-sider"
      >
        {sidebarContent}
      </Sider>

      {/* Sider for Mobile (Drawer) */}
      <Drawer
        placement="left"
        closable={false}
        onClose={() => setMobileVisible(false)}
        open={mobileVisible}
        width={250}
        styles={{ body: { padding: 0 } }}
      >
        {sidebarContent}
      </Drawer>

      <Layout>
        <Header style={{ 
          background: '#ffffff', 
          padding: '0 24px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
          height: '64px',
          zIndex: 9
        }}>
          <Space>
            {/* Desktop toggle */}
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{ fontSize: '16px', width: 64, height: 64 }}
              className="desktop-toggle-btn"
            />
            {/* Mobile toggle */}
            <Button
              type="text"
              icon={<MenuUnfoldOutlined />}
              onClick={() => setMobileVisible(true)}
              style={{ fontSize: '16px', width: 64, height: 64 }}
              className="mobile-toggle-btn"
            />
            <span style={{ fontSize: '16px', fontWeight: 600, color: '#333333' }}>
              MSME Container Logistics Portal
            </span>
          </Space>
          
          <Space size="middle">
            <Tag color={getRoleTagColor(user?.role)} style={{ fontWeight: 600 }}>
              {user?.role?.toUpperCase()}
            </Tag>
            <Space>
              <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#0d47a1' }} />
              <span style={{ fontWeight: 500, color: '#333' }}>{user?.name}</span>
            </Space>
          </Space>
        </Header>

        <Content style={{ 
          margin: '24px', 
          padding: '24px', 
          background: '#ffffff', 
          borderRadius: '8px', 
          minHeight: 280,
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.02)',
          overflowY: 'auto'
        }}>
          <Outlet />
        </Content>
      </Layout>

      <style>{`
        .mobile-toggle-btn {
          display: none !important;
        }
        @media (min-width: 768px) {
          .desktop-sider {
            display: block !important;
          }
        }
        @media (max-width: 767px) {
          .desktop-toggle-btn {
            display: none !important;
          }
          .mobile-toggle-btn {
            display: inline-block !important;
          }
        }
      `}</style>
    </Layout>
  );
};

export default AppLayout;
