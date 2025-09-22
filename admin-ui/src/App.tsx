import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "./services/firebase";
import { fetchLeads, updateLeadMemo } from "./services/leads";
import { deleteLeadsCall, incrementDownloadsCall } from "./services/functions";
import { getAdminsCall, addAdminCall, removeAdminCall } from "./services/admins";
import { leadsToCsv } from "./utils/csv";
import { useLeads } from "./hooks/useLeads";
import type { Lead } from "./types";

// ✨ 수정: List, Popconfirm, Tag 등 추가
import { App as AntApp, Layout, Button, Typography, Space, Card, Spin, ConfigProvider, Menu, Input, List, Popconfirm, Tag } from "antd";
import { GoogleOutlined, LogoutOutlined, DatabaseOutlined, UsergroupAddOutlined, PlusOutlined } from "@ant-design/icons";
import koKR from "antd/locale/ko_KR";

import FiltersComponent from "./components/Filters";
import AntLeadsTable from "./components/AntLeadsTable";

const { Header, Content, Sider } = Layout;
const { Title, Text } = Typography;

// ✨ 추가: 운영자 데이터 타입을 명확하게 정의
type Admin = {
  email: string;
  role: "super-admin" | "admin";
};

// ✨ 운영자 관리 페이지 컴포넌트
const AdminsPage = () => {
  const { message } = AntApp.useApp();
  // ✨ 수정: state 타입을 Admin 객체 배열로 변경
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      // ✨ 수정: TypeScript 오류를 해결하기 위해 'as unknown'을 추가하여 명시적인 타입 변환을 수행합니다.
      const adminList = (await getAdminsCall()) as unknown as Admin[];
      setAdmins(adminList);
    } catch (e: any) {
      message.error(`운영자 목록을 불러오는 데 실패했습니다: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAdmins();
  }, []);

  const handleAddAdmin = async () => {
    if (!newAdminEmail || !newAdminEmail.includes("@")) {
      message.warning("올바른 이메일 형식을 입력해주세요.");
      return;
    }
    setIsAdding(true);
    try {
      await addAdminCall(newAdminEmail);
      message.success(`${newAdminEmail} 님을 운영자로 추가했습니다.`);
      setNewAdminEmail("");
      await fetchAdmins(); // 목록 새로고침
    } catch (e: any) {
      message.error(`운영자 추가에 실패했습니다: ${e.message}`);
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveAdmin = async (emailToRemove: string) => {
    try {
      await removeAdminCall(emailToRemove);
      message.success(`${emailToRemove} 님을 운영자에서 삭제했습니다.`);
      await fetchAdmins(); // 목록 새로고침
    } catch (e: any) {
      message.error(`운영자 삭제에 실패했습니다: ${e.message}`);
    }
  };

  return (
    <Card title='운영자 관리'>
      <Space.Compact style={{ marginBottom: 24, width: "100%", maxWidth: 400 }}>
        <Input placeholder='추가할 Google 계정 이메일' value={newAdminEmail} onChange={(e) => setNewAdminEmail(e.target.value)} onPressEnter={handleAddAdmin} />
        <Button type='primary' icon={<PlusOutlined />} onClick={handleAddAdmin} loading={isAdding}>
          추가
        </Button>
      </Space.Compact>
      <List
        header={<div>운영자 목록</div>}
        bordered
        loading={loading}
        dataSource={admins}
        // ✨ 수정: renderItem의 파라미터를 admin 객체로 받고, 내부에서 admin.email과 admin.role을 사용
        renderItem={(admin) => (
          <List.Item
            actions={[
              admin.role !== "super-admin" && (
                <Popconfirm title={`${admin.email} 님을 정말 삭제하시겠습니까?`} onConfirm={() => handleRemoveAdmin(admin.email)} okText='삭제' cancelText='취소'>
                  <Button danger size='small'>
                    삭제
                  </Button>
                </Popconfirm>
              ),
            ]}
          >
            <List.Item.Meta title={admin.email} description={<Tag color={admin.role === "super-admin" ? "gold" : "blue"}>{admin.role}</Tag>} />
          </List.Item>
        )}
      />
    </Card>
  );
};

// ✨ 리드 관리 페이지 컴포넌트
const LeadsPage = () => {
  const { modal, message } = AntApp.useApp();
  const { confirm } = modal;

  const [rows, setRows] = useState<Lead[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const { filters, updateFilters, page, setPage, total, pageRows, pageSize } = useLeads(rows);

  const reload = async () => {
    setLoading(true);
    try {
      const data = await fetchLeads();
      setRows(data);
    } catch (e: any) {
      message.error("데이터를 불러오는 데 실패했습니다.");
    }
    setPage(1);
    setSelected([]);
    setLoading(false);
  };

  useEffect(() => {
    void reload();
  }, []);

  const downloadCsv = async () => {
    if (selected.length === 0) {
      message.warning("다운로드할 행을 선택해주세요.");
      return;
    }
    const chosen = rows.filter((r) => selected.includes(r.id));
    const csv = leadsToCsv(chosen);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads_selected_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    try {
      await incrementDownloadsCall(chosen.map((r) => r.id));
      const inc = new Set(chosen.map((r) => r.id));
      setRows((prev) => prev.map((r) => (inc.has(r.id) ? { ...r, download: Number(r.download ?? 0) + 1 } : r)));
      message.success(`${chosen.length}건의 다운로드 카운트를 업데이트했습니다.`);
    } catch (e: any) {
      message.error(`다운로드 카운트 업데이트 실패: ${e?.message}`);
    }
  };

  const handleDelete = () => {
    if (selected.length === 0) {
      message.warning("삭제할 리드를 선택해주세요.");
      return;
    }
    confirm({
      title: `${selected.length}개의 리드를 정말 삭제하시겠습니까?`,
      content: "삭제된 데이터는 복구할 수 없습니다.",
      okText: "삭제",
      okType: "danger",
      cancelText: "취소",
      onOk: async () => {
        try {
          setLoading(true);
          await deleteLeadsCall(selected);
          message.success(`${selected.length}개의 리드를 삭제했습니다.`);
          setRows((prev) => prev.filter((row) => !selected.includes(row.id)));
          setSelected([]);
        } catch (e: any) {
          message.error(`삭제 중 오류가 발생했습니다: ${e.message}`);
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const handleMemoSave = async (leadId: string, memo: string) => {
    try {
      await updateLeadMemo(leadId, memo);
      setRows((prev) => prev.map((row) => (row.id === leadId ? { ...row, memo } : row)));
      message.success("메모가 저장되었습니다.");
    } catch (e: any) {
      message.error(`메모 저장 중 오류가 발생했습니다: ${e.message}`);
    }
  };

  return (
    <Card>
      <FiltersComponent value={filters} onChange={updateFilters} onReload={reload} onDownload={downloadCsv} onDelete={handleDelete} selectedCount={selected.length} />
      <div style={{ marginTop: 24 }}>
        <AntLeadsTable
          rows={pageRows}
          loading={loading}
          selectedRowKeys={selected}
          onSelectionChange={setSelected}
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onMemoSave={handleMemoSave}
        />
      </div>
    </Card>
  );
};

// ✨ 메인 앱 로직
const AdminApp = () => {
  const [me, setMe] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentMenu, setCurrentMenu] = useState("leads");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setMe(u?.email ?? null);
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  const login = async () => await signInWithPopup(auth, googleProvider);
  const logout = async () => await signOut(auth);

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

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider>
        <div style={{ height: 32, margin: 16, background: "rgba(255, 255, 255, 0.2)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6 }}>
          Admin Menu
        </div>
        <Menu
          theme='dark'
          mode='inline'
          defaultSelectedKeys={["leads"]}
          onSelect={({ key }) => setCurrentMenu(key)}
          items={[
            { key: "leads", icon: <DatabaseOutlined />, label: "DB 목록" },
            { key: "admins", icon: <UsergroupAddOutlined />, label: "운영자 관리" },
          ]}
        />
      </Sider>
      <Layout>
        <Header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "white", padding: "0 24px" }}>
          <Space>
            <Title level={3} style={{ margin: 0 }}>
              기획공장 Admin
            </Title>
            <Text type='secondary'>{currentMenu === "leads" ? "Leads 관리" : "운영자 관리"}</Text>
          </Space>
          <Button icon={<LogoutOutlined />} onClick={logout}>
            로그아웃
          </Button>
        </Header>
        <Content style={{ padding: "24px" }}>
          {currentMenu === "leads" && <LeadsPage />}
          {currentMenu === "admins" && <AdminsPage />}
        </Content>
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
