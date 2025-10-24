import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider, functions } from "./services/firebase"; // functions 임포트 추가
import { httpsCallable } from "firebase/functions"; // httpsCallable 임포트 추가
import { Routes, Route, Link, useNavigate, useLocation, Navigate } from "react-router-dom";

import { App as AntApp, Layout, Button, Typography, Space, Card, Spin, ConfigProvider, Menu, Result } from "antd";
import type { MenuProps } from "antd";
import {
  GoogleOutlined,
  LogoutOutlined,
  DatabaseOutlined,
  UsergroupAddOutlined,
  MenuUnfoldOutlined,
  MenuFoldOutlined,
  DollarCircleOutlined,
  HistoryOutlined,
  LineChartOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import koKR from "antd/locale/ko_KR";

import { LeadsPage } from "./pages/LeadsPage";
import { AdminsPage } from "./pages/AdminsPage";
import { SettlementPage } from "./pages/SettlementPage";
import { HistoryPage } from "./pages/HistoryPage";
import { RoasPage } from "./pages/RoasPage";
import { ApiSettingsPage } from "./pages/ApiSettingsPage";

const { Header, Content, Sider } = Layout;
const { Title } = Typography;

// --- Helper Components & Hooks ---
const useAuth = () => {
  const [me, setMe] = useState<string | null>(null);
  const [myRole, setMyRole] = useState<"super-admin" | "admin" | "user" | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user && user.email) {
        setMe(user.email);
        setRoleLoading(true);
        try {
          // Firestore 직접 접근 대신 getMyRole Cloud Function 호출
          const getMyRole = httpsCallable(functions, "getMyRole");
          const result = await getMyRole();
          const { role } = result.data as { role: "super-admin" | "admin" | "user" | null };
          setMyRole(role);
        } catch (e) {
          console.error("Failed to get user role:", e);
          setMyRole(null);
        } finally {
          setRoleLoading(false);
        }
      } else {
        setMe(null);
        setMyRole(null);
        setRoleLoading(false);
      }
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  return { me, myRole, authLoading, roleLoading };
};

const ProtectedRoute = ({ children, allowedRoles, myRole }: { children: JSX.Element; allowedRoles: Array<"super-admin" | "admin" | "user">; myRole: "super-admin" | "admin" | "user" | null }) => {
  const isAllowed = myRole && allowedRoles.includes(myRole);
  return isAllowed ? children : <Navigate to='/unauthorized' replace />;
};

// --- Main App Component ---
const AppContent = () => {
  const { me, myRole, authLoading, roleLoading } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const login = async () => await signInWithPopup(auth, googleProvider);
  const logout = async () => {
    await signOut(auth);
    navigate("/");
  };

  if (authLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <Spin size='large' />
      </div>
    );
  }

  if (!me) {
    return (
      <Layout style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Card title='기획공장 Admin'>
          <p>Google 계정으로 로그인하세요.</p>
          <Button type='primary' icon={<GoogleOutlined />} onClick={login} block>
            Google 로그인
          </Button>
        </Card>
      </Layout>
    );
  }

  if (roleLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <Spin size='large' />
      </div>
    );
  }

  if (!myRole) {
    return (
      <Layout style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Card title='접근 불가'>
          <p>접근 권한이 없습니다. ({me})</p>
          <Button icon={<LogoutOutlined />} onClick={logout} block>
            로그아웃
          </Button>
        </Card>
      </Layout>
    );
  }

  const menuKey = location.pathname.split("/")[1] || "dbs";
  const menuItems: MenuProps["items"] = [{ key: "dbs", icon: <DatabaseOutlined />, label: <Link to='/dbs'>DB 목록</Link> }];
  if (myRole === "admin" || myRole === "super-admin") {
    menuItems.push({ key: "admins", icon: <UsergroupAddOutlined />, label: <Link to='/admins'>운영자 관리</Link> });
    menuItems.push({ key: "settlement", icon: <DollarCircleOutlined />, label: <Link to='/settlement'>정산</Link> });
  }
  if (myRole === "super-admin") {
    menuItems.push({ key: "history", icon: <HistoryOutlined />, label: <Link to='/history'>히스토리</Link> });
    menuItems.push({ key: "roas", icon: <LineChartOutlined />, label: <Link to='/roas'>ROAS 분석</Link> });
    menuItems.push({ key: "api-settings", icon: <SettingOutlined />, label: <Link to='/api-settings'>API 연동 설정</Link> });
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
        <Header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "white", padding: "0 24px" }}>
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
          <Routes>
            <Route path='/' element={<Navigate to='/dbs' replace />} />
            <Route
              path='/dbs'
              element={
                <ProtectedRoute myRole={myRole} allowedRoles={["super-admin", "admin", "user"]}>
                  <LeadsPage myRole={myRole} />
                </ProtectedRoute>
              }
            />
            <Route
              path='/admins'
              element={
                <ProtectedRoute myRole={myRole} allowedRoles={["super-admin", "admin"]}>
                  <AdminsPage myRole={myRole as "super-admin" | "admin"} />
                </ProtectedRoute>
              }
            />
            <Route
              path='/settlement'
              element={
                <ProtectedRoute myRole={myRole} allowedRoles={["super-admin", "admin"]}>
                  <SettlementPage myRole={myRole as "super-admin" | "admin"} />
                </ProtectedRoute>
              }
            />
            <Route
              path='/history'
              element={
                <ProtectedRoute myRole={myRole} allowedRoles={["super-admin"]}>
                  <HistoryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path='/roas'
              element={
                <ProtectedRoute myRole={myRole} allowedRoles={["super-admin"]}>
                  <RoasPage />
                </ProtectedRoute>
              }
            />
            <Route
              path='/unauthorized'
              element={
                <Result
                  status='403'
                  title='403'
                  subTitle='죄송합니다. 이 페이지에 접근할 권한이 없습니다.'
                  extra={
                    <Button type='primary' onClick={() => navigate("/dbs")}>
                      DB 목록으로 돌아가기
                    </Button>
                  }
                />
              }
            />
            <Route
              path='*'
              element={
                <Result
                  status='404'
                  title='404'
                  subTitle='죄송합니다. 페이지를 찾을 수 없습니다.'
                  extra={
                    <Button type='primary' onClick={() => navigate("/dbs")}>
                      DB 목록으로 돌아가기
                    </Button>
                  }
                />
              }
            />
            <Route
              path='/api-settings'
              element={
                <ProtectedRoute myRole={myRole} allowedRoles={["super-admin"]}>
                  <ApiSettingsPage />
                </ProtectedRoute>
              }
            />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
};

export default function App() {
  return (
    <ConfigProvider locale={koKR}>
      <AntApp>
        <AppContent />
      </AntApp>
    </ConfigProvider>
  );
}
