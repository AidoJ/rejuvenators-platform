import React, { useState, useEffect } from 'react';
import {
  Card,
  Tabs,
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
  TimePicker,
  Checkbox,
  Typography,
  Space,
  Tag,
  Divider,
  Alert,
  Upload,
  Avatar
} from 'antd';
import {
  UserOutlined,
  EnvironmentOutlined,
  ToolOutlined,
  ClockCircleOutlined,
  SaveOutlined,
  HomeOutlined,
  RadiusSettingOutlined,
  CameraOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { supabaseClient } from '../utility';
import GooglePlacesAddressInput from './GooglePlacesAddressInput';
import TherapistLocationMap from './TherapistLocationMap';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;
const { TabPane } = Tabs;

interface AddressData {
  formatted_address: string;
  components: {
    streetNumber?: string;
    streetName?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
    countryCode?: string;
  };
  geometry: {
    lat: number;
    lng: number;
  };
  place_id: string;
}

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

interface Service {
  id: string;
  name: string;
  description?: string;
  service_base_price: number;
}

interface AvailabilitySlot {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

interface EnhancedTherapistProfileFormProps {
  profileId?: string;
  mode: 'create' | 'edit';
  onSave: (profile: TherapistProfile) => void;
}

const EnhancedTherapistProfileForm: React.FC<EnhancedTherapistProfileFormProps> = ({
  profileId,
  mode,
  onSave
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(mode === 'edit');
  const [profile, setProfile] = useState<TherapistProfile | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [activeTab, setActiveTab] = useState('personal');
  const [addressData, setAddressData] = useState<AddressData | null>(null);

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  useEffect(() => {
    loadServices();
    if (mode === 'edit' && profileId) {
      loadProfile();
    } else {
      setInitialLoading(false);
      initializeDefaultAvailability();
    }
  }, [profileId, mode]);

  const loadServices = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('services')
        .select('*')
        .order('name');

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error('Error loading services:', error);
      message.error('Failed to load services');
    }
  };

  const loadProfile = async () => {
    if (!profileId) return;

    try {
      setInitialLoading(true);

      // Load profile
      const { data: profileData, error: profileError } = await supabaseClient
        .from('therapist_profiles')
        .select('*')
        .eq('id', profileId)
        .single();

      if (profileError) throw profileError;

      setProfile(profileData);
      form.setFieldsValue(profileData);

      // Load selected services
      const { data: serviceData, error: serviceError } = await supabaseClient
        .from('therapist_services')
        .select('service_id')
        .eq('therapist_id', profileId);

      if (!serviceError && serviceData) {
        setSelectedServices(serviceData.map((item: any) => item.service_id));
      }

      // Load availability
      const { data: availabilityData, error: availabilityError } = await supabaseClient
        .from('therapist_availability')
        .select('*')
        .eq('therapist_id', profileId)
        .order('day_of_week');

      if (!availabilityError && availabilityData) {
        setAvailability(availabilityData);
      } else {
        initializeDefaultAvailability();
      }

    } catch (error) {
      console.error('Error loading profile:', error);
      message.error('Failed to load profile');
    } finally {
      setInitialLoading(false);
    }
  };

  const initializeDefaultAvailability = () => {
    const defaultAvailability: AvailabilitySlot[] = [];
    for (let day = 1; day <= 5; day++) { // Monday to Friday
      defaultAvailability.push({
        day_of_week: day,
        start_time: '09:00',
        end_time: '17:00',
        is_available: true
      });
    }
    // Weekend
    defaultAvailability.push({
      day_of_week: 0, // Sunday
      start_time: '10:00',
      end_time: '16:00',
      is_available: false
    });
    defaultAvailability.push({
      day_of_week: 6, // Saturday
      start_time: '10:00',
      end_time: '16:00',
      is_available: false
    });
    setAvailability(defaultAvailability);
  };

  const handleAddressSelect = (data: AddressData) => {
    setAddressData(data);
    form.setFieldsValue({
      home_address: data.formatted_address,
      latitude: data.geometry.lat,
      longitude: data.geometry.lng
    });
  };

  const updateAvailability = (dayOfWeek: number, field: string, value: any) => {
    setAvailability(prev => prev.map(slot => 
      slot.day_of_week === dayOfWeek 
        ? { ...slot, [field]: value }
        : slot
    ));
  };

  const handleSubmit = async (values: any) => {
    try {
      setLoading(true);

      const profileData = {
        ...values,
        latitude: addressData?.geometry.lat || values.latitude,
        longitude: addressData?.geometry.lng || values.longitude,
        updated_at: new Date().toISOString()
      };

      let savedProfile;

      if (mode === 'create') {
        const { data, error } = await supabaseClient
          .from('therapist_profiles')
          .insert([profileData])
          .select()
          .single();

        if (error) throw error;
        savedProfile = data;
      } else {
        const { data, error } = await supabaseClient
          .from('therapist_profiles')
          .update(profileData)
          .eq('id', profileId)
          .select()
          .single();

        if (error) throw error;
        savedProfile = data;
      }

      // Save services
      if (savedProfile.id) {
        // Delete existing services
        await supabaseClient
          .from('therapist_services')
          .delete()
          .eq('therapist_id', savedProfile.id);

        // Insert new services
        if (selectedServices.length > 0) {
          const serviceInserts = selectedServices.map((serviceId: string) => ({
            therapist_id: savedProfile.id,
            service_id: serviceId
          }));

          const { error: serviceError } = await supabaseClient
            .from('therapist_services')
            .insert(serviceInserts);

          if (serviceError) throw serviceError;
        }

        // Save availability
        await supabaseClient
          .from('therapist_availability')
          .delete()
          .eq('therapist_id', savedProfile.id);

        const availabilityInserts = availability.map((slot: AvailabilitySlot) => ({
          therapist_id: savedProfile.id,
          day_of_week: slot.day_of_week,
          start_time: slot.start_time,
          end_time: slot.end_time,
          is_available: slot.is_available
        }));

        const { error: availabilityError } = await supabaseClient
          .from('therapist_availability')
          .insert(availabilityInserts);

        if (availabilityError) throw availabilityError;
      }

      message.success(`Profile ${mode === 'create' ? 'created' : 'updated'} successfully!`);
      onSave(savedProfile);

    } catch (error) {
      console.error('Error saving profile:', error);
      message.error('Failed to save profile');
    } finally {
      setLoading(false);
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
    <Card>
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
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab={<span><UserOutlined />Personal Info</span>} key="personal">
            <Row gutter={24}>
              <Col span={12}>
                <Form.Item
                  label="First Name"
                  name="first_name"
                  rules={[{ required: true, message: 'Please enter first name' }]}
                >
                  <Input />
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

            <Form.Item label="Active Status" name="is_active" valuePropName="checked">
              <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
            </Form.Item>
          </TabPane>

          <TabPane tab={<span><EnvironmentOutlined />Location</span>} key="location">
            <Alert
              message="Address Geocoding"
              description="Enter your address to automatically set location coordinates for booking proximity matching."
              type="info"
              style={{ marginBottom: 24 }}
            />

            <Form.Item label="Home Address" name="home_address">
              <GooglePlacesAddressInput
                onAddressSelect={handleAddressSelect}
                placeholder="Start typing your address..."
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
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="Service Radius (km)" name="service_radius_km">
                  <InputNumber min={1} max={200} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>

            {form.getFieldValue('latitude') && form.getFieldValue('longitude') && (
              <TherapistLocationMap
                address={form.getFieldValue('home_address')}
                latitude={form.getFieldValue('latitude')}
                longitude={form.getFieldValue('longitude')}
                serviceRadius={form.getFieldValue('service_radius_km') || 50}
                height={300}
              />
            )}
          </TabPane>

          <TabPane tab={<span><ToolOutlined />Services</span>} key="services">
            <Alert
              message="Select Services"
              description="Choose the massage services you provide. This helps customers find you for specific treatments."
              type="info"
              style={{ marginBottom: 24 }}
            />

            <Checkbox.Group
              value={selectedServices}
              onChange={setSelectedServices}
              style={{ width: '100%' }}
            >
              <Row gutter={[16, 16]}>
                {services.map((service: Service) => (
                  <Col span={12} key={service.id}>
                    <Card size="small" style={{ cursor: 'pointer' }}>
                      <Checkbox value={service.id}>
                        <Space direction="vertical" size="small">
                          <Text strong>{service.name}</Text>
                          <Text type="secondary">{service.description}</Text>
                          <Tag color="blue">Base: ${service.service_base_price}</Tag>
                        </Space>
                      </Checkbox>
                    </Card>
                  </Col>
                ))}
              </Row>
            </Checkbox.Group>

            {selectedServices.length === 0 && (
              <Alert
                message="No services selected"
                description="Please select at least one service to continue."
                type="warning"
                style={{ marginTop: 16 }}
              />
            )}
          </TabPane>

          <TabPane tab={<span><ClockCircleOutlined />Availability</span>} key="availability">
            <Alert
              message="Set Your Availability"
              description="Configure your working hours for each day of the week."
              type="info"
              style={{ marginBottom: 24 }}
            />

            {availability.map((slot: AvailabilitySlot) => (
              <Card key={slot.day_of_week} size="small" style={{ marginBottom: 16 }}>
                <Row gutter={16} align="middle">
                  <Col span={4}>
                    <Text strong>{dayNames[slot.day_of_week]}</Text>
                  </Col>
                  <Col span={3}>
                    <Switch
                      checked={slot.is_available}
                      onChange={(checked) => updateAvailability(slot.day_of_week, 'is_available', checked)}
                      checkedChildren="Available"
                      unCheckedChildren="Unavailable"
                    />
                  </Col>
                  <Col span={6}>
                    <TimePicker
                      value={dayjs(slot.start_time, 'HH:mm')}
                      format="HH:mm"
                      disabled={!slot.is_available}
                      onChange={(time) => 
                        updateAvailability(slot.day_of_week, 'start_time', time?.format('HH:mm') || '09:00')
                      }
                      style={{ width: '100%' }}
                    />
                  </Col>
                  <Col span={2} style={{ textAlign: 'center' }}>
                    <Text>to</Text>
                  </Col>
                  <Col span={6}>
                    <TimePicker
                      value={dayjs(slot.end_time, 'HH:mm')}
                      format="HH:mm"
                      disabled={!slot.is_available}
                      onChange={(time) => 
                        updateAvailability(slot.day_of_week, 'end_time', time?.format('HH:mm') || '17:00')
                      }
                      style={{ width: '100%' }}
                    />
                  </Col>
                </Row>
              </Card>
            ))}
          </TabPane>
        </Tabs>

        <Divider />

        <Row justify="end" gutter={16}>
          <Col>
            <Button size="large">
              Cancel
            </Button>
          </Col>
          <Col>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              loading={loading}
              icon={<SaveOutlined />}
            >
              {mode === 'create' ? 'Create Profile' : 'Save Changes'}
            </Button>
          </Col>
        </Row>
      </Form>
    </Card>
  );
};

export default EnhancedTherapistProfileForm;
