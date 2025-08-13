import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  Select,
  Button,
  Row,
  Col,
  InputNumber,
  Switch,
  message,
  Spin,
  Typography,
  Space,
  Upload,
  Avatar,
  Tabs
} from 'antd';
import {
  UserOutlined,
  SaveOutlined,
  ArrowLeftOutlined,
  CameraOutlined,
  EnvironmentOutlined,
  PhoneOutlined,
  MailOutlined
} from '@ant-design/icons';
import { useGetIdentity } from '@refinedev/core';
import { useParams, useNavigate } from 'react-router';
import { supabaseClient } from '../../utility';

const { Title } = Typography;
const { TextArea } = Input;
const { Option } = Select;
const { TabPane } = Tabs;

interface TherapistProfile {
  id?: string;
  user_id?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  bio?: string;
  profile_pic?: string;
  home_address?: string;
  latitude?: number;
  longitude?: number;
  service_radius_km?: number;
  is_active: boolean;
  gender?: string;
  years_experience?: number;
  rating?: number;
  total_reviews?: number;
  business_abn: string;
  address_verified?: boolean;
}

const TherapistProfileManagement: React.FC = () => {
  const [form] = Form.useForm();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: identity } = useGetIdentity<any>();
  
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(!!id);
  const [profile, setProfile] = useState<TherapistProfile | null>(null);
  const [fileList, setFileList] = useState<any[]>([]);

  const profileId = id || identity?.therapist_profile_id;
  const isOwnProfile = !id || (identity?.therapist_profile_id && id === identity.therapist_profile_id);
  const isAdmin = identity?.role === 'admin' || identity?.role === 'super_admin';

  useEffect(() => {
    if (profileId) {
      loadProfile();
    } else {
      setInitialLoading(false);
    }
    loadGoogleMaps();
  }, [profileId]);

  const loadGoogleMaps = () => {
    if (!(window as any).google) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY}&libraries=places`;
      script.onload = () => {
        setupAddressAutocomplete();
      };
      document.head.appendChild(script);
    } else {
      setupAddressAutocomplete();
    }
  };

  const setupAddressAutocomplete = () => {
    setTimeout(() => {
      const addressInput = document.getElementById('home_address');
      if (!addressInput || !(window as any).google) return;

      const autocomplete = new (window as any).google.maps.places.Autocomplete(addressInput, {
        types: ['address'],
        componentRestrictions: { country: 'AU' },
        fields: ['address_components', 'formatted_address', 'geometry']
      });

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (place.geometry) {
          form.setFieldsValue({
            home_address: place.formatted_address,
            latitude: place.geometry.location.lat(),
            longitude: place.geometry.location.lng(),
            address_verified: true
          });
          message.success('Address verified and coordinates saved!');
        }
      });
    }, 100);
  };

  const loadProfile = async () => {
    if (!profileId) return;

    try {
      setInitialLoading(true);

      const { data, error } = await supabaseClient
        .from('therapist_profiles')
        .select('*')
        .eq('id', profileId)
        .single();

      if (error) throw error;

      setProfile(data);
      form.setFieldsValue(data);

      // Set up image file list if profile pic exists
      if (data.profile_pic) {
        setFileList([{
          uid: '1',
          name: 'profile.jpg',
          status: 'done',
          url: data.profile_pic
        }]);
      }

    } catch (error: any) {
      console.error('Error loading profile:', error);
      message.error('Failed to load profile');
    } finally {
      setInitialLoading(false);
    }
  };

  const handleImageUpload = async (file: any) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${profileId || 'new'}_${Date.now()}.${fileExt}`;
      const filePath = `therapist-photos/${fileName}`;

      const { error: uploadError } = await supabaseClient.storage
        .from('therapist-photos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabaseClient.storage
        .from('therapist-photos')
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      setLoading(true);

      let profilePicUrl = values.profile_pic;

      // Handle image upload if new file selected
      if (fileList.length > 0 && fileList[0].originFileObj) {
        profilePicUrl = await handleImageUpload(fileList[0].originFileObj);
      }

      const profileData = {
        ...values,
        profile_pic: profilePicUrl,
        updated_at: new Date().toISOString()
      };

      let savedProfile;

      if (profileId) {
        // Update existing profile
        const { data, error } = await supabaseClient
          .from('therapist_profiles')
          .update(profileData)
          .eq('id', profileId)
          .select()
          .single();

        if (error) throw error;
        savedProfile = data;
      } else {
        // Create new profile
        const { data, error } = await supabaseClient
          .from('therapist_profiles')
          .insert([profileData])
          .select()
          .single();

        if (error) throw error;
        savedProfile = data;
      }

      message.success(`Profile ${profileId ? 'updated' : 'created'} successfully!`);
      setProfile(savedProfile);

      if (profileData.latitude && profileData.longitude) {
        message.success('Location coordinates saved for proximity matching!');
      }

    } catch (error: any) {
      console.error('Error saving profile:', error);
      message.error('Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (isAdmin && !isOwnProfile) {
      navigate('/therapists');
    } else {
      navigate('/dashboard');
    }
  };

  const uploadProps = {
    name: 'file',
    listType: 'picture-card' as const,
    fileList: fileList,
    beforeUpload: () => false, // Prevent auto upload
    onChange: ({ fileList: newFileList }: any) => {
      setFileList(newFileList);
    },
    onPreview: (file: any) => {
      const src = file.url || file.preview;
      if (src) {
        const imgWindow = window.open(src);
        imgWindow?.document.write(`<img src="${src}" style="width: 100%;" />`);
      }
    }
  };

  if (initialLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Button 
              icon={<ArrowLeftOutlined />} 
              onClick={handleBack}
              style={{ marginBottom: '16px' }}
            >
              Back
            </Button>
            <Title level={2} style={{ margin: 0 }}>
              {profileId ? 'Edit Therapist Profile' : 'Create Therapist Profile'}
            </Title>
          </div>

          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            initialValues={{
              is_active: true,
              service_radius_km: 50,
              gender: 'prefer_not_to_say',
              rating: 0,
              total_reviews: 0,
              address_verified: false
            }}
          >
            <Tabs defaultActiveKey="personal">
              <TabPane tab="Personal Info" key="personal">
                <Row gutter={24}>
                  <Col span={24} style={{ textAlign: 'center', marginBottom: 24 }}>
                    <Form.Item label="Profile Photo">
                      <Upload {...uploadProps}>
                        {fileList.length >= 1 ? null : (
                          <div>
                            <CameraOutlined style={{ fontSize: 24, marginBottom: 8 }} />
                            <div>Upload Photo</div>
                          </div>
                        )}
                      </Upload>
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={24}>
                  <Col span={12}>
                    <Form.Item
                      label="First Name"
                      name="first_name"
                      rules={[{ required: true, message: 'Please enter first name' }]}
                    >
                      <Input prefix={<UserOutlined />} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      label="Last Name"
                      name="last_name"
                      rules={[{ required: true, message: 'Please enter last name' }]}
                    >
                      <Input />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={24}>
                  <Col span={12}>
                    <Form.Item
                      label="Email"
                      name="email"
                      rules={[
                        { required: true, message: 'Please enter email' },
                        { type: 'email', message: 'Please enter valid email' }
                      ]}
                    >
                      <Input prefix={<MailOutlined />} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="Phone" name="phone">
                      <Input prefix={<PhoneOutlined />} />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={24}>
                  <Col span={12}>
                    <Form.Item label="Gender" name="gender">
                      <Select>
                        <Option value="male">Male</Option>
                        <Option value="female">Female</Option>
                        <Option value="other">Other</Option>
                        <Option value="prefer_not_to_say">Prefer not to say</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="Years of Experience" name="years_experience">
                      <InputNumber min={0} max={50} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item
                  label="Business ABN"
                  name="business_abn"
                  rules={[
                    { required: true, message: 'Please enter business ABN' },
                    { pattern: /^\d{11}$/, message: 'ABN must be exactly 11 digits' }
                  ]}
                >
                  <Input placeholder="11 digit ABN number" />
                </Form.Item>

                <Form.Item label="Bio" name="bio">
                  <TextArea 
                    rows={4} 
                    placeholder="Tell customers about yourself, your specialties, and your approach to massage therapy..." 
                  />
                </Form.Item>

                <Form.Item label="Active Status" name="is_active" valuePropName="checked">
                  <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
                </Form.Item>
              </TabPane>

              <TabPane tab="Location & Service Area" key="location">
                <Form.Item 
                  label="Home Address" 
                  name="home_address"
                  help="Start typing your address and select from the dropdown for automatic location verification"
                >
                  <Input 
                    id="home_address"
                    prefix={<EnvironmentOutlined />}
                    placeholder="Start typing your address..."
                    onFocus={setupAddressAutocomplete}
                  />
                </Form.Item>

                <Row gutter={24}>
                  <Col span={8}>
                    <Form.Item label="Latitude" name="latitude">
                      <InputNumber 
                        style={{ width: '100%' }} 
                        step={0.000001}
                        precision={6}
                        disabled
                        placeholder="Auto-filled"
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="Longitude" name="longitude">
                      <InputNumber 
                        style={{ width: '100%' }} 
                        step={0.000001}
                        precision={6}
                        disabled
                        placeholder="Auto-filled"
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="Service Radius (km)" name="service_radius_km">
                      <InputNumber min={1} max={200} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item label="Address Verified" name="address_verified" valuePropName="checked">
                  <Switch 
                    checkedChildren="Verified" 
                    unCheckedChildren="Not Verified"
                    disabled
                  />
                </Form.Item>
              </TabPane>

              <TabPane tab="Performance" key="performance">
                <Row gutter={24}>
                  <Col span={12}>
                    <Form.Item label="Rating" name="rating">
                      <InputNumber 
                        min={0} 
                        max={5} 
                        step={0.1}
                        style={{ width: '100%' }}
                        disabled
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="Total Reviews" name="total_reviews">
                      <InputNumber 
                        min={0}
                        style={{ width: '100%' }}
                        disabled
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </TabPane>
            </Tabs>

            <div style={{ marginTop: '32px', textAlign: 'right' }}>
              <Button size="large" style={{ marginRight: '8px' }} onClick={handleBack}>
                Cancel
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                loading={loading}
                icon={<SaveOutlined />}
              >
                {profileId ? 'Save Changes' : 'Create Profile'}
              </Button>
            </div>
          </Form>
        </Space>
      </Card>
    </div>
  );
};

export default TherapistProfileManagement;
