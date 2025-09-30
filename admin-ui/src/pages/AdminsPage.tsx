import { useEffect, useState } from "react";
import { App, Button, Space, Card, Input, List, Popconfirm, Tag, Select, Switch, Typography } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { getAdminsCall, addAdminCall, removeAdminCall, updateAdminRoleCall, updateAdminNotificationsCall } from "../services/admins";
import type { Admin } from "../types";

const { Text } = Typography;
interface AdminsPageProps {
  myRole: "super-admin" | "admin";
}

export const AdminsPage = ({ myRole }: AdminsPageProps) => {
  const { message } = App.useApp();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const fetchAdmins = async () => {
    setLoading(true);
    try {
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
      await addAdminCall(newAdminEmail, "user");
      message.success(`${newAdminEmail} 님을 사용자로 추가했습니다.`);
      setNewAdminEmail("");
      await fetchAdmins();
    } catch (e: any) {
      message.error(`사용자 추가에 실패했습니다: ${e.message}`);
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveAdmin = async (emailToRemove: string) => {
    try {
      await removeAdminCall(emailToRemove);
      message.success(`${emailToRemove} 님을 삭제했습니다.`);
      await fetchAdmins();
    } catch (e: any) {
      message.error(`삭제에 실패했습니다: ${e.message}`);
    }
  };

  const handleRoleChange = async (email: string, role: "admin" | "user") => {
    try {
      await updateAdminRoleCall(email, role);
      message.success(`${email} 님의 권한을 ${role}으로 변경했습니다.`);
      await fetchAdmins();
    } catch (e: any) {
      message.error(`권한 변경에 실패했습니다: ${e.message}`);
    }
  };

  const handleNotificationChange = async (email: string, field: "notifyOnNewLead" | "notifyOnDailySummary", value: boolean) => {
    try {
      await updateAdminNotificationsCall(email, field, value);
      setAdmins((prev) => prev.map((admin) => (admin.email === email ? { ...admin, [field]: value } : admin)));
      message.success("알림 설정이 변경되었습니다.");
    } catch (e: any) {
      message.error(`알림 설정 변경에 실패했습니다: ${e.message}`);
      await fetchAdmins(); // 실패 시 데이터 다시 불러오기
    }
  };

  const isSuperAdmin = myRole === "super-admin";

  return (
    <Card title='운영자 관리'>
      {isSuperAdmin && (
        <Space.Compact style={{ marginBottom: 24, width: "100%", maxWidth: 400 }}>
          <Input placeholder='추가할 Google 계정 이메일' value={newAdminEmail} onChange={(e) => setNewAdminEmail(e.target.value)} onPressEnter={handleAddAdmin} />
          <Button type='primary' icon={<PlusOutlined />} onClick={handleAddAdmin} loading={isAdding}>
            사용자 추가
          </Button>
        </Space.Compact>
      )}
      <List
        header={<div>운영자 목록</div>}
        bordered
        loading={loading}
        dataSource={admins}
        renderItem={(admin) => (
          <List.Item
            key={admin.email}
            actions={
              isSuperAdmin && admin.role !== "super-admin"
                ? [
                    <Select key='select' value={admin.role} onChange={(value) => handleRoleChange(admin.email, value)} style={{ width: 120 }}>
                      <Select.Option value='admin'>Admin</Select.Option>
                      <Select.Option value='user'>User</Select.Option>
                    </Select>,
                    <Popconfirm key='delete' title={`${admin.email} 님을 정말 삭제하시겠습니까?`} onConfirm={() => handleRemoveAdmin(admin.email)} okText='삭제' cancelText='취소'>
                      <Button danger size='small'>
                        삭제
                      </Button>
                    </Popconfirm>,
                  ]
                : []
            }
          >
            <List.Item.Meta title={admin.email} description={<Tag color={admin.role === "super-admin" ? "red" : admin.role === "admin" ? "geekblue" : "default"}>{admin.role}</Tag>} />
            {/* ✨ 추가: 이메일 수신 여부 설정 UI */}
            {isSuperAdmin && (
              <Space size='large'>
                <Space>
                  <Text>신규알림</Text>
                  <Switch checked={admin.notifyOnNewLead} onChange={(checked) => handleNotificationChange(admin.email, "notifyOnNewLead", checked)} disabled={admin.role === "super-admin"} />
                </Space>
                <Space>
                  <Text>일일요약</Text>
                  <Switch checked={admin.notifyOnDailySummary} onChange={(checked) => handleNotificationChange(admin.email, "notifyOnDailySummary", checked)} disabled={admin.role === "super-admin"} />
                </Space>
              </Space>
            )}
          </List.Item>
        )}
      />
    </Card>
  );
};
