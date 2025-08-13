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
  Space
} from 'antd';
import {
  UserOutlined,
  SaveOutlined,
  ArrowLeftOutlined
} from '@ant-design/icons';
import { useGetIdentity } from '@refinedev/core';
import { useParams, useNavigate } from 'react-router';
import { supabaseClient } from '../../utility';

const { Title } = Typography;
const { TextArea } = Input;
const { Option } = Select;

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
}

const TherapistProfileManagement: React.FC = () => {
  const [form] = Form.useForm();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: identity } = useGetIdentity();
  
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(!!id);
  const [profile, setProfile] = useState<TherapistProfile | null>(null);

  const profileId = id || identity?.therapist_profile_id;
  const isOwnProfile = !id || (identity?.therapist_profile_id && id === identity.therapist_profile_id);
  const isAdmin = identity?.role === 'admin' || identity?.role === 'super_admin';

  useEffect(() => {
    if (profileId) {
      loadProfile();
    } else {
      setInitialLoading(false);
    }
  }, [profileId]);

  // Load Google Maps API for address autocomplete
  useEffect(() => {
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
  }, []);

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
            longitude: place.geometry.location.lng()
          });
          message.success('Address geocoded successfully!');
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

    } catch (error: any) {
      console.error('Error loading profile:', error);
      message.error('Failed to load profile');
    } finally {
      setInitialLoading(false);
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      setLoading(true);

      const profileData = {
        ...values,
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
              gender: 'prefer_not_to_say'
            }}
          >
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
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Phone" name="phone">
                  <Input />
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

            <Form.Item label="Bio" name="bio">
              <TextArea rows={4} placeholder="Tell us about yourself and your experience..." />
            </Form.Item>

            <Form.Item 
              label="Home Address (with Google Places autocomplete)" 
              name="home_address"
              help="Start typing to see address suggestions. Selecting an address will automatically set coordinates for proximity matching."
            >
              <Input 
                id="home_address" 
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
                    placeholder="Auto-filled from address"
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
                    placeholder="Auto-filled from address"
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="Service Radius (km)" name="service_radius_km">
                  <InputNumber min={1} max={200} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item label="Active Status" name="is_active" valuePropName="checked">
              <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
            </Form.Item>

            {/* Hidden fields for lat/lng */}
            <Form.Item name="latitude" hidden>
              <Input />
            </Form.Item>
            <Form.Item name="longitude" hidden>
              <Input />
            </Form.Item>

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
