import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "./services/firebase";
import { getMyRoleCall } from "./services/admins";
import { App as AntApp, Layout, Button, Typography, Space, Card, Spin, ConfigProvider, Menu, Result } from "antd";
import type { MenuProps } from "antd";
import { GoogleOutlined, LogoutOutlined, DatabaseOutlined, UsergroupAddOutlined, MenuUnfoldOutlined, MenuFoldOutlined } from "@ant-design/icons";
import koKR from "antd/locale/ko_KR";
import { LeadsPage } from "./pages/LeadsPage";
import { AdminsPage } from "./pages/AdminsPage";

const { Header, Content, Sider } = Layout;
const { Title } = Typography;

const AdminApp = () => {
  const [me, setMe] = useState<string | null>(null);
  const [myRole, setMyRole] = useState<"super-admin" | "admin" | "user" | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [pathname, setPathname] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", handlePopState);
    if (window.location.pathname === "/") {
      const defaultPath = "/dbs";
      window.history.replaceState({}, "", defaultPath);
      setPathname(defaultPath);
    }
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setAuthLoading(true);
      if (user && user.email) {
        setMe(user.email);
        try {
          const { role } = await getMyRoleCall();
          setMyRole(role);
        } catch (e) {
          console.error("Failed to get user role:", e);
          setMyRole(null);
        }
      } else {
        setMe(null);
        setMyRole(null);
      }
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  const login = async () => await signInWithPopup(auth, googleProvider);
  const logout = async () => {
    await signOut(auth);
    window.location.href = "/";
  };

  const handleMenuSelect = ({ key }: { key: string }) => {
    const newPath = `/${key}`;
    if (pathname !== newPath) {
      window.history.pushState({}, "", newPath);
      setPathname(newPath);
    }
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

  const menuKey = pathname.startsWith("/admins") ? "admins" : "dbs";
  const menuItems: MenuProps["items"] = [{ key: "dbs", icon: <DatabaseOutlined />, label: "DB 목록" }];
  if (myRole === "admin" || myRole === "super-admin") {
    menuItems.push({ key: "admins", icon: <UsergroupAddOutlined />, label: "운영자 관리" });
  }

  const renderContent = () => {
    if (pathname.startsWith("/dbs")) {
      // ✨ 수정: 불필요한 myRole 속성 제거
      return <LeadsPage />;
    }
    if (pathname.startsWith("/admins")) {
      if (myRole === "admin" || myRole === "super-admin") {
        return <AdminsPage myRole={myRole} />;
      }
      return (
        <Result
          status='403'
          title='403'
          subTitle='죄송합니다. 이 페이지에 접근할 권한이 없습니다.'
          extra={
            <Button type='primary' onClick={() => (window.location.href = "/dbs")}>
              DB 목록으로 돌아가기
            </Button>
          }
        />
      );
    }
    return (
      <Result
        status='404'
        title='404'
        subTitle='죄송합니다. 페이지를 찾을 수 없습니다.'
        extra={
          <Button type='primary' onClick={() => (window.location.href = "/dbs")}>
            DB 목록으로 돌아가기
          </Button>
        }
      />
    );
  };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={(value) => setCollapsed(value)}
        breakpoint='lg'
        onBreakpoint={(broken) => setCollapsed(broken)}
        collapsedWidth={0}
        trigger={null}
        style={{ position: "fixed", left: 0, top: 0, bottom: 0, height: "100vh", overflow: "auto" }}
      >
        <div style={{ height: 32, margin: 16, background: "rgba(255, 255, 255, 0.2)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6 }}>Admin</div>
        <Menu theme='dark' mode='inline' selectedKeys={[menuKey]} onSelect={handleMenuSelect} items={menuItems} />
      </Sider>
      <Layout style={{ marginLeft: collapsed ? 0 : 200, transition: "margin-left 0.2s" }}>
        <Header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "white", padding: "0 16px" }}>
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
        <Content style={{ padding: "16px", margin: 0, minHeight: 280, background: "#f0f2f5" }}>{renderContent()}</Content>
      </Layout>
    </Layout>
  );
};

export default function App() {
  return (
    <ConfigProvider locale={koKR}>
      <AntApp>
        <AdminApp />
      </AntApp>
    </ConfigProvider>
  );
}
