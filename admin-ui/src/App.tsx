import { useEffect, useState } from "react";
// ✨ 수정: 빠져있던 signOut을 다시 import 합니다.
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "./services/firebase";
import { getMyRoleFromFirestore } from "./services/admins";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";

import { App as AntApp, Layout, Button, Card, Spin, ConfigProvider, Result } from "antd";
import { GoogleOutlined, LogoutOutlined } from "@ant-design/icons";
import koKR from "antd/locale/ko_KR";

// ✨ 수정: AppLayout.tsx 파일을 올바르게 import 합니다.
import { AppLayout } from "./components/AppLayout";
import { LeadsPage } from "./pages/LeadsPage";
import { AdminsPage } from "./pages/AdminsPage";
import { SettlementPage } from "./pages/SettlementPage";
import { HistoryPage } from "./pages/HistoryPage";

// --- Helper Hook & Component ---
export const useAuth = () => {
  const [me, setMe] = useState<string | null>(null);
  const [myRole, setMyRole] = useState<"super-admin" | "admin" | "user" | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user && user.email) {
        setMe(user.email);
        try {
          const role = await getMyRoleFromFirestore(user.email);
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

const ProtectedRoute = ({ allowedRoles, myRole }: { allowedRoles: Array<"super-admin" | "admin" | "user">; myRole: "super-admin" | "admin" | "user" | null }) => {
  const isAllowed = myRole && allowedRoles.includes(myRole);
  return isAllowed ? <Outlet /> : <Navigate to='/unauthorized' replace />;
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

// --- Main App Component ---
const App = () => {
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

        <Route element={<ProtectedRoute myRole={myRole} allowedRoles={["super-admin", "admin"]} />}>
          {/* ✨ 수정: 타입 오류를 해결하기 위해 myRole을 확인하고 전달합니다. */}
          <Route path='admins' element={(myRole === "super-admin" || myRole === "admin") && <AdminsPage myRole={myRole} />} />
          <Route path='settlement' element={(myRole === "super-admin" || myRole === "admin") && <SettlementPage myRole={myRole} />} />
        </Route>

        <Route element={<ProtectedRoute myRole={myRole} allowedRoles={["super-admin"]} />}>
          <Route path='history' element={<HistoryPage />} />
        </Route>

        <Route path='unauthorized' element={<Result status='403' title='403' subTitle='죄송합니다. 이 페이지에 접근할 권한이 없습니다.' />} />
        <Route path='*' element={<Result status='404' title='404' subTitle='죄송합니다. 페이지를 찾을 수 없습니다.' />} />
      </Route>
    </Routes>
  );
};

// --- Top-level Wrapper ---
const Root = () => (
  <ConfigProvider locale={koKR}>
    <AntApp>
      <App />
    </AntApp>
  </ConfigProvider>
);

export default Root;
