import React, { useState, useEffect, useRef } from 'react';
import {
  Form,
  Input,
  InputNumber,
  Select,
  Button,
  Card,
  Row,
  Col,
  Space,
  Divider,
  message,
  Tag,
  Checkbox,
  Upload,
  Avatar,
  Tabs,
  TimePicker,
  Table,
  Popconfirm,
  Alert
} from 'antd';
import {
  UserOutlined,
  EnvironmentOutlined,
  SaveOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  PlusOutlined,
  DeleteOutlined,
  UploadOutlined
} from '@ant-design/icons';
import { supabaseClient } from '../../utility';
import GooglePlacesAddressInput, { GooglePlacesAddressInputRef } from './GooglePlacesAddressInput';
import TherapistLocationMap from './TherapistLocationMap';
import dayjs from 'dayjs';

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
  address_verified?: boolean;
  service_radius_km?: number;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  years_experience?: number;
  is_active?: boolean;
}

interface Service {
  id: string;
  name: string;
  description?: string;
  service_base_price: number;
}

interface Availability {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

interface EnhancedTherapistProfileFormProps {
  profileId?: string;
  onSave?: (profile: TherapistProfile) => void;
  mode?: 'create' | 'edit';
}

const EnhancedTherapistProfileForm: React.FC<EnhancedTherapistProfileFormProps> = ({
  profileId,
  onSave,
  mode = 'edit'
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<TherapistProfile | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [addressVerified, setAddressVerified] = useState(false);
  const [locationData, setLocationData] = useState<{lat?: number, lng?: number}>({});
  
  const addressInputRef = useRef<GooglePlacesAddressInputRef>(null);
  const [activeTab, setActiveTab] = useState('personal');

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  useEffect(() => {
    if (profileId) {
      fetchProfile();
    }
    fetchServices();
  }, [profileId]);

  const fetchProfile = async () => {
    if (!profileId) return;
    
    try {
      setLoading(true);
      
      const { data: profileData, error } = await supabaseClient
        .from('therapist_profiles')
        .select('*')
        .eq('id', profileId)
        .single();

      if (error) throw error;

      setProfile(profileData);
      setAddressVerified(profileData.address_verified || false);
      setLocationData({
        lat: profileData.latitude,
        lng: profileData.longitude
      });

      // Populate form
      form.setFieldsValue({
        ...profileData,
        service_radius_km: profileData.service_radius_km || 20
      });

      // Fetch related data
      await Promise.all([
        fetchTherapistServices(profileId),
        fetchTherapistAvailability(profileId)
      ]);

    } catch (error) {
      console.error('Error fetching profile:', error);
      message.error('Failed to load therapist profile');
    } finally {
      setLoading(false);
    }
  };

  const fetchServices = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('services')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error('Error fetching services:', error);
    }
  };

  const fetchTherapistServices = async (therapistId: string) => {
    try {
      const { data, error } = await supabaseClient
        .from('therapist_services')
        .select('service_id')
        .eq('therapist_id', therapistId);

      if (error) throw error;
      setSelectedServices(data?.map(item => item.service_id) || []);
    } catch (error) {
      console.error('Error fetching therapist services:', error);
    }
  };

  const fetchTherapistAvailability = async (therapistId: string) => {
    try {
      const { data, error } = await supabaseClient
        .from('therapist_availability')
        .select('*')
        .eq('therapist_id', therapistId)
        .order('day_of_week')
        .order('start_time');

      if (error) throw error;
      setAvailability(data || []);
    } catch (error) {
      console.error('Error fetching availability:', error);
    }
  };

  const handleAddressSelected = (addressData: any) => {
    setLocationData({
      lat: addressData.geometry.lat,
      lng: addressData.geometry.lng
    });
    setAddressVerified(true);
    
    // Update form values
    form.setFieldsValue({
      home_address: addressData.formatted_address,
      latitude: addressData.geometry.lat,
      longitude: addressData.geometry.lng,
      address_verified: true
    });
  };

  const handleValidationChange = (isValid: boolean) => {
    setAddressVerified(isValid);
    if (!isValid) {
      setLocationData({});
      form.setFieldsValue({
        latitude: null,
        longitude: null,
        address_verified: false
      });
    }
  };

  const onFinish = async (values: any) => {
    try {
      setSaving(true);

      // Validate address is geocoded
      if (!addressVerified || !locationData.lat || !locationData.lng) {
        message.error('Please select a valid address from the autocomplete suggestions');
        setActiveTab('personal');
        return;
      }

      const profileData = {
        ...values,
        latitude: locationData.lat,
        longitude: locationData.lng,
        address_verified: addressVerified
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
        await saveTherapistServices(savedProfile.id);
        await saveTherapistAvailability(savedProfile.id);
      }

      message.success('Profile saved successfully!');
      onSave?.(savedProfile);

    } catch (error) {
      console.error('Error saving profile:', error);
      message.error('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const saveTherapistServices = async (therapistId: string) => {
    try {
      // Remove existing services
      await supabaseClient
        .from('therapist_services')
        .delete()
        .eq('therapist_id', therapistId);

      // Add selected services
      if (selectedServices.length > 0) {
        const serviceRecords = selectedServices.map(serviceId => ({
          therapist_id: therapistId,
          service_id: serviceId
        }));

        const { error } = await supabaseClient
          .from('therapist_services')
          .insert(serviceRecords);

        if (error) throw error;
      }
    } catch (error) {
      console.error('Error saving services:', error);
      throw error;
    }
  };

  const saveTherapistAvailability = async (therapistId: string) => {
    try {
      // Remove existing availability
      await supabaseClient
        .from('therapist_availability')
        .delete()
        .eq('therapist_id', therapistId);

      // Add new availability
      if (availability.length > 0) {
        const availabilityRecords = availability.map(item => ({
          therapist_id: therapistId,
          day_of_week: item.day_of_week,
          start_time: item.start_time,
          end_time: item.end_time
        }));

        const { error } = await supabaseClient
          .from('therapist_availability')
          .insert(availabilityRecords);

        if (error) throw error;
      }
    } catch (error) {
      console.error('Error saving availability:', error);
      throw error;
    }
  };

  const addAvailability = (values: any) => {
    const newAvailability: Availability = {
      day_of_week: values.day_of_week,
      start_time: values.start_time.format('HH:mm:ss'),
      end_time: values.end_time.format('HH:mm:ss')
    };

    setAvailability(prev => [...prev, newAvailability]);
    form.resetFields(['day_of_week', 'start_time', 'end_time']);
    message.success('Availability added');
  };

  const removeAvailability = (index: number) => {
    setAvailability(prev => prev.filter((_, i) => i !== index));
  };

  const availabilityColumns = [
    {
      title: 'Day',
      dataIndex: 'day_of_week',
      key: 'day_of_week',
      render: (day: number) => dayNames[day]
    },
    {
      title: 'Start Time',
      dataIndex: 'start_time',
      key: 'start_time',
      render: (time: string) => dayjs(time, 'HH:mm:ss').format('h:mm A')
    },
    {
      title: 'End Time',
      dataIndex: 'end_time',
      key: 'end_time',
      render: (time: string) => dayjs(time, 'HH:mm:ss').format('h:mm A')
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, __: any, index: number) => (
        <Popconfirm
          title="Remove this availability?"
          onConfirm={() => removeAvailability(index)}
          okText="Yes"
          cancelText="No"
        >
          <Button type="text" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      )
    }
  ];

  return (
    <Card title={`${mode === 'create' ? 'Create' : 'Edit'} Therapist Profile`} loading={loading}>
      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        initialValues={{
          service_radius_km: 20,
          is_active: true,
          gender: 'prefer_not_to_say'
        }}
      >
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="Personal Info" key="personal">
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Form.Item
                  label="First Name"
                  name="first_name"
                  rules={[{ required: true, message: 'First name is required' }]}
                >
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="Last Name"
                  name="last_name"
                  rules={[{ required: true, message: 'Last name is required' }]}
                >
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="Email"
                  name="email"
                  rules={[
                    { required: true, message: 'Email is required' },
                    { type: 'email', message: 'Please enter a valid email' }
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
                <Form.Item label="Years Experience" name="years_experience">
                  <InputNumber min={0} max={50} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={24}>
                <Form.Item label="Bio" name="bio">
                  <TextArea rows={4} placeholder="Tell us about your experience and specialties..." />
                </Form.Item>
              </Col>
            </Row>
          </TabPane>

          <TabPane 
            tab={
              <span>
                <EnvironmentOutlined />
                Location {addressVerified ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : <WarningOutlined style={{ color: '#fa8c16' }} />}
              </span>
            } 
            key="location"
          >
            <Alert
              message="Address Geocoding Required"
              description="Please enter and select your home address from the autocomplete suggestions. This enables distance-based booking assignments."
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            
            <Row gutter={[16, 16]}>
              <Col span={16}>
                <Form.Item
                  label="Home Address"
                  name="home_address"
                  rules={[{ required: true, message: 'Home address is required' }]}
                  extra={
                    addressVerified ? (
                      <span style={{ color: '#52c41a' }}>
                        <CheckCircleOutlined /> Address verified and geocoded
                      </span>
                    ) : (
                      <span style={{ color: '#fa8c16' }}>
                        <WarningOutlined /> Please select an address from the suggestions
                      </span>
                    )
                  }
                >
                  <GooglePlacesAddressInput
                    ref={addressInputRef}
                    onAddressSelected={handleAddressSelected}
                    onValidationChange={handleValidationChange}
                    placeholder="Start typing your address..."
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  label="Service Radius (km)"
                  name="service_radius_km"
                  rules={[{ required: true, message: 'Service radius is required' }]}
                >
                  <InputNumber min={1} max={100} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={24}>
                <TherapistLocationMap
                  latitude={locationData.lat}
                  longitude={locationData.lng}
                  address={form.getFieldValue('home_address')}
                  serviceRadius={form.getFieldValue('service_radius_km') || 20}
                  showRadius={true}
                  height={300}
                />
              </Col>
            </Row>

            {/* Hidden fields for lat/lng */}
            <Form.Item name="latitude" hidden>
              <InputNumber />
            </Form.Item>
            <Form.Item name="longitude" hidden>
              <InputNumber />
            </Form.Item>
            <Form.Item name="address_verified" hidden>
              <Checkbox />
            </Form.Item>
          </TabPane>

          <TabPane tab="Services" key="services">
            <div style={{ marginBottom: 16 }}>
              <h4>Select Services You Offer</h4>
              <p style={{ color: '#8c8c8c' }}>Choose which massage services you provide. This determines what customers can book with you.</p>
            </div>
            
            <Row gutter={[8, 8]}>
              {services.map(service => (
                <Col span={12} key={service.id}>
                  <Card 
                    size="small" 
                    style={{ 
                      cursor: 'pointer',
                      border: selectedServices.includes(service.id) ? '2px solid #1890ff' : '1px solid #d9d9d9'
                    }}
                    onClick={() => {
                      if (selectedServices.includes(service.id)) {
                        setSelectedServices(prev => prev.filter(id => id !== service.id));
                      } else {
                        setSelectedServices(prev => [...prev, service.id]);
                      }
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 500 }}>{service.name}</div>
                        <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
                          Base Price: ${service.service_base_price}
                        </div>
                      </div>
                      <Checkbox 
                        checked={selectedServices.includes(service.id)}
                        onChange={() => {}}
                      />
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          </TabPane>

          <TabPane tab="Availability" key="availability">
            <div style={{ marginBottom: 16 }}>
              <h4>Set Your Availability</h4>
              <p style={{ color: '#8c8c8c' }}>Define when you're available for bookings. Customers will only be able to book during these times.</p>
            </div>

            <Card size="small" title="Add New Availability" style={{ marginBottom: 16 }}>
              <Form layout="inline" onFinish={addAvailability}>
                <Form.Item
                  name="day_of_week"
                  rules={[{ required: true, message: 'Select a day' }]}
                >
                  <Select placeholder="Select Day" style={{ width: 120 }}>
                    {dayNames.map((day, index) => (
                      <Option key={index} value={index}>{day}</Option>
                    ))}
                  </Select>
                </Form.Item>
                <Form.Item
                  name="start_time"
                  rules={[{ required: true, message: 'Select start time' }]}
                >
                  <TimePicker format="h:mm A" placeholder="Start Time" />
                </Form.Item>
                <Form.Item
                  name="end_time"
                  rules={[{ required: true, message: 'Select end time' }]}
                >
                  <TimePicker format="h:mm A" placeholder="End Time" />
                </Form.Item>
                <Form.Item>
                  <Button type="primary" htmlType="submit" icon={<PlusOutlined />}>
                    Add
                  </Button>
                </Form.Item>
              </Form>
            </Card>

            <Table
              dataSource={availability}
              columns={availabilityColumns}
              rowKey={(record, index) => `${record.day_of_week}-${record.start_time}-${index}`}
              size="small"
              pagination={false}
            />
          </TabPane>
        </Tabs>

        <Divider />

        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={saving} icon={<SaveOutlined />}>
              Save Profile
            </Button>
            <Button onClick={() => form.resetFields()}>
              Reset
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default EnhancedTherapistProfileForm;
