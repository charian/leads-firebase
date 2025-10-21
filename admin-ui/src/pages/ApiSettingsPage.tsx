// charian/leads-firebase/leads-firebase-055a667c5c853ad85aee2ec7f79d21492d3b2ea1/admin-ui/src/pages/ApiSettingsPage.tsx (수정)

import { useState, useEffect } from "react";
import { Card, Form, Input, Button, Typography, message, Spin, Row, Col } from "antd";
import { getApiSettings, saveApiSettings } from "../services/apiSettings"; // <-- 추가

const { Title, Paragraph } = Typography;

export const ApiSettingsPage = () => {
  const [loading, setLoading] = useState(true);
  const [form] = Form.useForm();

  useEffect(() => {
    // ✨ Firestore에서 저장된 API 설정 정보 불러오기
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const settings = await getApiSettings();
        form.setFieldsValue(settings);
      } catch (error: any) {
        message.error(`설정을 불러오는 데 실패했습니다: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [form]);

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      // ✨ Firestore에 API 설정 정보 저장하기
      await saveApiSettings(values);
      message.success("API 연동 정보가 성공적으로 저장되었습니다.");
    } catch (error: any) {
      message.error(`저장에 실패했습니다: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Spin spinning={loading}>
      <Title level={2}>API 연동 설정</Title>
      <Paragraph>광고비 자동 수집을 위해 각 플랫폼의 API 연동 정보를 입력해주세요.</Paragraph>

      <Form form={form} layout='vertical' onFinish={onFinish}>
        <Row gutter={24}>
          <Col xs={24} md={12}>
            <Card title='TikTok Ads API' style={{ marginBottom: 24 }}>
              <Form.Item name={["tiktok", "appId"]} label='App ID'>
                <Input placeholder='TikTok App ID' />
              </Form.Item>
              <Form.Item name={["tiktok", "secret"]} label='Secret'>
                <Input.Password placeholder='TikTok Secret Key' />
              </Form.Item>
              <Form.Item name={["tiktok", "advertiserId"]} label='Advertiser ID'>
                <Input placeholder='TikTok Advertiser ID' />
              </Form.Item>
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card title='Google Ads API' style={{ marginBottom: 24 }}>
              <Form.Item name={["google", "developerToken"]} label='Developer Token'>
                <Input.Password placeholder='Google Ads Developer Token' />
              </Form.Item>
              <Form.Item name={["google", "clientId"]} label='Client ID'>
                <Input placeholder='Google Ads Client ID' />
              </Form.Item>
              <Form.Item name={["google", "clientSecret"]} label='Client Secret'>
                <Input.Password placeholder='Google Ads Client Secret' />
              </Form.Item>
              <Form.Item name={["google", "refreshToken"]} label='Refresh Token'>
                <Input.Password placeholder='Google Ads Refresh Token' />
              </Form.Item>
            </Card>
          </Col>
        </Row>

        <Form.Item>
          <Button type='primary' htmlType='submit'>
            저장하기
          </Button>
        </Form.Item>
      </Form>
    </Spin>
  );
};
