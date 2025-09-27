import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "./services/firebase";
import { getMyRoleFromFirestore } from "./services/admins";
import { Routes, Route, Link, useNavigate, useLocation, Navigate } from "react-router-dom";

import { App as AntApp, Layout, Button, Typography, Space, Card, Spin, ConfigProvider, Menu, Result } from "antd";
import type { MenuProps } from "antd";
import { GoogleOutlined, LogoutOutlined, DatabaseOutlined, UsergroupAddOutlined, MenuUnfoldOutlined, MenuFoldOutlined, DollarCircleOutlined, HistoryOutlined } from "@ant-design/icons";
import koKR from "antd/locale/ko_KR";

import { LeadsPage } from "./pages/LeadsPage";
import { AdminsPage } from "./pages/AdminsPage";
import { SettlementPage } from "./pages/SettlementPage";
import { HistoryPage } from "./pages/HistoryPage";

const { Header, Content, Sider } = Layout;
const { Title } = Typography;

// --- Helper Components & Hooks ---
const useAuth = () => {
  const [me, setMe] = useState<string | null>(null);
  const [myRole, setMyRole] = useState<"super-admin" | "admin" | "user" | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  // ✨ 수정: 역할 로딩 상태를 추가합니다.
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      // ✨ 수정: user 객체가 존재하고 email이 있는 경우에만 로직을 실행합니다.
      if (user && user.email) {
        setMe(user.email);
        setRoleLoading(true); // ✨ 수정: 역할을 가져오기 시작할 때 로딩 상태를 true로 설정합니다.
        try {
          // Firebase의 emailVerified 속성을 사용하여 이메일이 인증되었는지 확인합니다.
          if (user.emailVerified) {
            const role = await getMyRoleFromFirestore(user.email);
            setMyRole(role);
          } else {
            // 이메일이 인증되지 않았다면 역할을 null로 설정합니다.
            setMyRole(null);
          }
        } catch (e) {
          console.error("Failed to get user role:", e);
          setMyRole(null);
        } finally {
          setRoleLoading(false); // ✨ 수정: 역할을 가져온 후 로딩 상태를 false로 설정합니다.
        }
      } else {
        setMe(null);
        setMyRole(null);
        setRoleLoading(false); // ✨ 수정: 로그인되지 않은 상태이므로 로딩 상태를 false로 설정합니다.
      }
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  // ✨ 수정: 반환 값에 roleLoading을 추가합니다.
  return { me, myRole, authLoading, roleLoading };
};

const ProtectedRoute = ({ children, allowedRoles, myRole }: { children: JSX.Element; allowedRoles: Array<"super-admin" | "admin" | "user">; myRole: "super-admin" | "admin" | "user" | null }) => {
  const isAllowed = myRole && allowedRoles.includes(myRole);
  return isAllowed ? children : <Navigate to='/unauthorized' replace />;
};

// --- Main App Component ---
const AppContent = () => {
  // ✨ 수정: useAuth 훅에서 roleLoading을 가져옵니다.
  const { me, myRole, authLoading, roleLoading } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const login = async () => await signInWithPopup(auth, googleProvider);
  const logout = async () => {
    await signOut(auth);
    navigate("/");
  };

  // ✨ 수정: 초기 인증 로딩 중일 때 로딩 화면을 보여줍니다.
  if (authLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <Spin size='large' />
      </div>
    );
  }
  // ✨ 수정: 로그인 상태가 아닐 때 로그인 페이지를 보여줍니다.
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
  // ✨ 수정: 역할 정보 로딩 중일 때 로딩 화면을 보여줍니다.
  if (roleLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <Spin size='large' />
      </div>
    );
  }
  // ✨ 수정: 역할을 성공적으로 가져왔지만, 그 역할이 null일 때 (권한이 없을 때) '접근 불가' 화면을 보여줍니다.
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
