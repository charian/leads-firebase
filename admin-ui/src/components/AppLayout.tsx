import { useState } from "react";
import { signOut } from "firebase/auth";
// ✨ 수정: 올바른 경로에서 auth를 import 합니다.
import { auth } from "../services/firebase";
import { Link, useLocation, Outlet, useNavigate } from "react-router-dom";

import { Layout, Button, Typography, Space, Menu } from "antd";
import type { MenuProps } from "antd";
import { LogoutOutlined, DatabaseOutlined, UsergroupAddOutlined, MenuUnfoldOutlined, MenuFoldOutlined, DollarCircleOutlined, HistoryOutlined, LineChartOutlined } from "@ant-design/icons";

const { Header, Content, Sider } = Layout;
const { Title } = Typography;

interface AppLayoutProps {
  myRole: "super-admin" | "admin" | "user";
}

export const AppLayout = ({ myRole }: AppLayoutProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const logout = async () => {
    await signOut(auth);
    navigate("/");
  };

  const menuKey = location.pathname.split("/")[1] || "dbs";
  const menuItems: MenuProps["items"] = [{ key: "dbs", icon: <DatabaseOutlined />, label: <Link to='/dbs'>DB 목록</Link> }];
  if (myRole === "admin" || myRole === "super-admin") {
    menuItems.push({ key: "admins", icon: <UsergroupAddOutlined />, label: <Link to='/admins'>운영자 관리</Link> });
    menuItems.push({ key: "settlement", icon: <DollarCircleOutlined />, label: <Link to='/settlement'>정산</Link> });
  }
  if (myRole === "super-admin") {
    menuItems.push({ key: "history", icon: <HistoryOutlined />, label: <Link to='/history'>히스토리</Link> });
    menuItems.push({ key: "roas", icon: <LineChartOutlined />, label: <Link to='/roas'>ROAS 분석</Link> });
  }

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider collapsible collapsed={collapsed} onCollapse={(value) => setCollapsed(value)} breakpoint='lg' onBreakpoint={(broken) => setCollapsed(broken)} collapsedWidth={80} trigger={null}>
        <div style={{ height: 32, margin: 16, background: "rgba(255, 255, 255, 0.2)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6 }}>
          {collapsed ? "A" : "Admin"}
        </div>
        <Menu theme='dark' mode='inline' selectedKeys={[menuKey]} items={menuItems} />
      </Sider>
      <Layout>
        <Header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "white", padding: "0 24px", position: "sticky", top: 0, zIndex: 1 }}>
          <Space>
            <Button type='text' icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />} onClick={() => setCollapsed(!collapsed)} style={{ fontSize: "16px", width: 48, height: 48 }} />
            <Title level={3} style={{ margin: 0, fontSize: "18px" }}>
              기획공장 Admin
            </Title>
          </Space>
          <Button icon={<LogoutOutlined />} onClick={logout}>
            로그아웃
          </Button>
        </Header>
        <Content style={{ padding: "24px", margin: 0, minHeight: 280, background: "#f0f2f5" }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};
