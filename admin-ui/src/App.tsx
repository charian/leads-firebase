import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "./services/firebase";
// ✨ 수정: getMyRoleCall을 사용하도록 변경
import { getMyRoleCall } from "./services/admins";
import { Routes, Route, Link, useNavigate, useLocation, Navigate, Outlet } from "react-router-dom";

import { App as AntApp, Layout, Button, Card, Spin, ConfigProvider, Result } from "antd";
import type { MenuProps } from "antd";
import { GoogleOutlined, LogoutOutlined, DatabaseOutlined, UsergroupAddOutlined, MenuUnfoldOutlined, MenuFoldOutlined, DollarCircleOutlined, HistoryOutlined } from "@ant-design/icons";
import koKR from "antd/locale/ko_KR";

import { LeadsPage } from "./pages/LeadsPage";
import { AdminsPage } from "./pages/AdminsPage";
import { SettlementPage } from "./pages/SettlementPage";
import { HistoryPage } from "./pages/HistoryPage";
import { AppLayout } from "./components/AppLayout";

const useAuth = () => {
  const [me, setMe] = useState<string | null>(null);
  const [myRole, setMyRole] = useState<"super-admin" | "admin" | "user" | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user && user.email) {
        setMe(user.email);
        try {
          // ✨ 수정: 안전한 getMyRoleCall 함수를 사용하여 등급을 확인합니다.
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

  return { me, myRole, authLoading };
};

const ProtectedRoute = ({ allowedRoles, myRole, children }: { children: JSX.Element; allowedRoles: Array<"super-admin" | "admin" | "user">; myRole: "super-admin" | "admin" | "user" | null }) => {
  const isAllowed = myRole && allowedRoles.includes(myRole);
  return isAllowed ? children : <Navigate to='/unauthorized' replace />;
};

const LoginPage = () => {
  const login = async () => await signInWithPopup(auth, googleProvider);
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
};

const AppRoutes = () => {
  const { me, myRole, authLoading } = useAuth();

  if (authLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <Spin size='large' />
      </div>
    );
  }

  if (!me) {
    return <LoginPage />;
  }

  if (!myRole) {
    return (
      <Layout style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Card title='접근 불가'>
          <p>접근 권한이 없습니다. ({me})</p>
          <Button icon={<LogoutOutlined />} onClick={() => signOut(auth)} block>
            로그아웃
          </Button>
        </Card>
      </Layout>
    );
  }

  return (
    <Routes>
      <Route path='/' element={<AppLayout myRole={myRole} />}>
        <Route index element={<Navigate to='/dbs' replace />} />
        <Route path='dbs' element={<LeadsPage />} />
        <Route
          path='admins'
          element={
            <ProtectedRoute myRole={myRole} allowedRoles={["super-admin", "admin"]}>
              <AdminsPage myRole={myRole as "super-admin" | "admin"} />
            </ProtectedRoute>
          }
        />
        <Route
          path='settlement'
          element={
            <ProtectedRoute myRole={myRole} allowedRoles={["super-admin", "admin"]}>
              <SettlementPage myRole={myRole as "super-admin" | "admin"} />
            </ProtectedRoute>
          }
        />
        <Route
          path='history'
          element={
            <ProtectedRoute myRole={myRole} allowedRoles={["super-admin"]}>
              <HistoryPage />
            </ProtectedRoute>
          }
        />
        <Route path='unauthorized' element={<Result status='403' title='403' subTitle='죄송합니다. 이 페이지에 접근할 권한이 없습니다.' />} />
        <Route path='*' element={<Result status='404' title='404' subTitle='죄송합니다. 페이지를 찾을 수 없습니다.' />} />
      </Route>
    </Routes>
  );
};

const App = () => (
  <ConfigProvider locale={koKR}>
    <AntApp>
      <AppRoutes />
    </AntApp>
  </ConfigProvider>
);

export default App;
