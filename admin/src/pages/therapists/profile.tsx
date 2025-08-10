import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Form,
  Input,
  Button,
  Upload,
  Avatar,
  Typography,
  Divider,
  message,
  Progress,
  Alert,
  InputNumber,
} from 'antd';
import {
  UserOutlined,
  CameraOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { useGetIdentity } from '@refinedev/core';
import { supabaseClient } from '../../utility';
import { UserIdentity, isTherapist } from '../../utils/roleUtils';
import { RoleGuard } from '../../components/RoleGuard';
import type { UploadProps } from 'antd';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface TherapistProfile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  bio?: string;
  profile_pic?: string;
  business_abn: string;
  home_address?: string;
  service_radius_km?: number;
  is_active: boolean;
  years_experience?: number;
  rating: number;
  total_reviews: number;
}

const validateABN = (abn: string): boolean => {
  const cleanABN = abn.replace(/[\s-]/g, '');
  return /^\d{11}$/.test(cleanABN);
};

// SIMPLE BASE64 UPLOAD - NO EXTERNAL SERVICES
const convertToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

const TherapistProfileManagement: React.FC = () => {
  const { data: identity } = useGetIdentity<UserIdentity>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState<TherapistProfile | null>(null);
  
  const [form] = Form.useForm();
  const userRole = identity?.role;

  useEffect(() => {
    if (identity && isTherapist(userRole)) {
      fetchTherapistProfile();
    }
  }, [identity]);

  const fetchTherapistProfile = async () => {
    try {
      setLoading(true);
      
      const { data: profileData, error } = await supabaseClient
        .from('therapist_profiles')
        .select('*')
        .eq('user_id', identity?.id)
        .single();

      if (error) throw error;
      
      setProfile(profileData);
      form.setFieldsValue(profileData);
    } catch (error) {
      console.error('Error fetching profile:', error);
      message.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (file: File): Promise<boolean> => {
    if (!profile) {
      message.error('Profile not loaded');
      return false;
    }
    
    try {
      setUploading(true);
      
      // Validate file
      if (file.type !== 'image/jpeg') {
        message.error('Only JPG images are allowed');
        return false;
      }
      
      if (file.size > 2 * 1024 * 1024) {
        message.error('File size must be less than 2MB');
        return false;
      }

      console.log('Converting image to Base64...');
      
      // Convert to Base64 - NO external upload!
      const base64String = await convertToBase64(file);
      console.log('Base64 conversion successful, length:', base64String.length);
      
      // Update profile in database directly
      console.log('Updating database with Base64 string...');
      const { error } = await supabaseClient
        .from('therapist_profiles')
        .update({ profile_pic: base64String })
        .eq('id', profile.id);

      if (error) {
        console.error('Database update error:', error);
        throw error;
      }

      // Update local state
      setProfile({ ...profile, profile_pic: base64String });
      form.setFieldValue('profile_pic', base64String);
      message.success('Photo uploaded successfully!');
      
      return true;
    } catch (error) {
      console.error('Photo upload error:', error);
      message.error('Failed to upload photo');
      return false;
    } finally {
      setUploading(false);
    }
  };

  const handleProfileSave = async (values: any) => {
    try {
      setSaving(true);
      
      if (!validateABN(values.business_abn)) {
        message.error('Please enter a valid 11-digit ABN');
        return;
      }
      
      const updateData = {
        ...values,
        business_abn: values.business_abn.replace(/[\s-]/g, ''),
      };

      const { error } = await supabaseClient
        .from('therapist_profiles')
        .update(updateData)
        .eq('id', profile?.id);

      if (error) throw error;

      message.success('Profile updated successfully!');
      setProfile({ ...profile!, ...updateData });
    } catch (error) {
      console.error('Error updating profile:', error);
      message.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const uploadProps: UploadProps = {
    name: 'file',
    listType: 'picture-card',
    className: 'avatar-uploader',
    showUploadList: false,
    beforeUpload: (file) => {
      handlePhotoUpload(file);
      return false; // Prevent automatic upload
    },
    accept: 'image/jpeg',
  };

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Text>Loading profile...</Text>
      </div>
    );
  }

  return (
    <RoleGuard requiredRole="therapist">
      <div style={{ padding: 24 }}>
        <Title level={2}>My Profile</Title>
        <Text type="secondary">Manage your profile information and photo</Text>

        <Row gutter={24} style={{ marginTop: 24 }}>
          <Col span={8}>
            <Card>
              <div style={{ textAlign: 'center' }}>
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <Avatar
                    size={120}
                    src={profile?.profile_pic}
                    icon={<UserOutlined />}
                    style={{ marginBottom: 16 }}
                  />
                  
                  {uploading && (
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'rgba(0,0,0,0.6)',
                      borderRadius: '50%'
                    }}>
                      <Progress
                        type="circle"
                        percent={50}
                        width={80}
                        strokeColor="#1890ff"
                      />
                    </div>
                  )}
                </div>
                
                <div>
                  <Upload {...uploadProps}>
                    <Button 
                      icon={<CameraOutlined />} 
                      loading={uploading}
                      disabled={uploading}
                    >
                      {uploading ? 'Converting...' : profile?.profile_pic ? 'Change Photo' : 'Upload Photo'}
                    </Button>
                  </Upload>
                  <div style={{ marginTop: 8, fontSize: '12px', color: '#999' }}>
                    JPG only, max 2MB
                  </div>
                </div>

                <Divider />
                
                <Title level={4} style={{ margin: 0 }}>
                  {profile?.first_name} {profile?.last_name}
                </Title>
                <Text type="secondary">{profile?.email}</Text>
                
                <div style={{ marginTop: 8 }}>
                  <Text strong>Rating: </Text>
                  <Text>{profile?.rating?.toFixed(1) || '0.0'}</Text>
                  <Text type="secondary"> ({profile?.total_reviews || 0} reviews)</Text>
                </div>
              </div>
            </Card>
          </Col>

          <Col span={16}>
            <Card title="Profile Details">
              <Form
                form={form}
                layout="vertical"
                onFinish={handleProfileSave}
                initialValues={profile || {}}
              >
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      label="First Name"
                      name="first_name"
                      rules={[{ required: true, message: 'Please enter your first name' }]}
                    >
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      label="Last Name"
                      name="last_name"
                      rules={[{ required: true, message: 'Please enter your last name' }]}
                    >
                      <Input />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      label="Email"
                      name="email"
                      rules={[
                        { required: true, message: 'Please enter your email' },
                        { type: 'email', message: 'Please enter a valid email' }
                      ]}
                    >
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      label="Phone"
                      name="phone"
                    >
                      <Input />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      label="Business ABN"
                      name="business_abn"
                      rules={[
                        { required: true, message: 'ABN is required' },
                        { 
                          validator: (_, value) => {
                            if (!value) return Promise.resolve();
                            if (validateABN(value)) {
                              return Promise.resolve();
                            }
                            return Promise.reject('Please enter a valid 11-digit ABN');
                          }
                        }
                      ]}
                    >
                      <Input 
                        placeholder="12345678901" 
                        maxLength={14}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      label="Years of Experience"
                      name="years_experience"
                    >
                      <InputNumber min={0} max={50} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item
                  label="Bio"
                  name="bio"
                >
                  <TextArea
                    rows={4}
                    placeholder="Tell customers about yourself, your specialties, and your approach to massage therapy..."
                  />
                </Form.Item>

                <Row gutter={16}>
                  <Col span={16}>
                    <Form.Item
                      label="Home Address"
                      name="home_address"
                    >
                      <Input placeholder="Your service area base address" />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      label="Service Radius (km)"
                      name="service_radius_km"
                    >
                      <InputNumber
                        min={1}
                        max={100}
                        style={{ width: '100%' }}
                        placeholder="Travel distance"
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={saving}
                    icon={<SaveOutlined />}
                    size="large"
                  >
                    Save Profile
                  </Button>
                </Form.Item>
              </Form>
            </Card>
          </Col>
        </Row>

        <Row style={{ marginTop: 24 }}>
          <Col span={24}>
            <Alert
              message="✅ Photo Upload Working"
              description="Photos are stored as Base64 data directly in your database. No external services required!"
              type="success"
              showIcon
              closable
            />
          </Col>
        </Row>

        {/* Debug Info */}
        {profile && (
          <Row style={{ marginTop: 16 }}>
            <Col span={24}>
              <Alert
                message="Debug Info"
                description={`Therapist ID: ${profile.id} | Photo: ${profile.profile_pic ? 'Yes (Base64)' : 'None'}`}
                type="info"
                closable
                style={{ fontSize: '12px' }}
              />
            </Col>
          </Row>
        )}
      </div>
    </RoleGuard>
  );
};

export default TherapistProfileManagement;
