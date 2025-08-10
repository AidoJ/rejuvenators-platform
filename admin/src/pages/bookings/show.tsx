import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Typography,
  Tag,
  Button,
  Space,
  Descriptions,
  Divider,
  Timeline,
  Modal,
  message,
  Tooltip,
  Avatar,
  Badge,
  Statistic,
  Alert,
  Drawer,
  Form,
  Select,
  Input,
  DatePicker,
  TimePicker,
  Switch,
} from 'antd';
import {
  UserOutlined,
  PhoneOutlined,
  MailOutlined,
  EnvironmentOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  HistoryOutlined,
  MoreOutlined,
  ArrowLeftOutlined,
  ReloadOutlined,
  PhoneOutlined as PhoneIcon,
  MessageOutlined,
} from '@ant-design/icons';
import { useGetIdentity, useNavigation, useShow } from '@refinedev/core';
import { supabaseClient } from '../../utility';
import { UserIdentity, canAccess, isTherapist, isAdmin } from '../../utils/roleUtils';
import { RoleGuard } from '../../components/RoleGuard';
import dayjs, { Dayjs } from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

// Interfaces
interface Booking {
  id: string;
  customer_id: string;
  therapist_id: string;
  service_id: string;
  booking_time: string;
  status: string;
  payment_status: string;
  price: number;
  therapist_fee: number;
  address: string;
  notes?: string;
  latitude?: number;
  longitude?: number;
  duration_minutes?: number;
  gender_preference?: string;
  parking?: string;
  room_number?: string;
  booking_id?: string;
  customer_code?: string;
  first_name?: string;
  last_name?: string;
  customer_email?: string;
  customer_phone?: string;
  therapist_response_time?: string;
  responding_therapist_id?: string;
  created_at: string;
  updated_at: string;
  
  // Joined data
  customer_name?: string;
  therapist_name?: string;
  service_name?: string;
  customer_details?: {
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
    address?: string;
    notes?: string;
  };
  therapist_details?: {
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
    bio?: string;
    profile_pic?: string;
  };
  service_details?: {
    name: string;
    description?: string;
    service_base_price: number;
    minimum_duration: number;
  };
}

interface StatusHistory {
  id: string;
  booking_id: string;
  status: string;
  changed_at: string;
  changed_by?: string;
  notes?: string;
  changed_by_name?: string;
}

interface BookingShowProps {
  id: string;
}

export const BookingShow: React.FC<BookingShowProps> = ({ id }) => {
  const { data: identity } = useGetIdentity<UserIdentity>();
  const { edit, list } = useNavigation();
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [statusHistory, setStatusHistory] = useState<StatusHistory[]>([]);
  const [showEditDrawer, setShowEditDrawer] = useState(false);
  const [editForm] = Form.useForm();
  const [updating, setUpdating] = useState(false);

  const userRole = identity?.role;

  useEffect(() => {
    if (id) {
      fetchBookingDetails();
    }
  }, [id]);

  const fetchBookingDetails = async () => {
    setLoading(true);
    try {
      // Fetch booking with joined data
      const { data: bookingData, error: bookingError } = await supabaseClient
        .from('bookings')
        .select(`
          *,
          customers!inner(first_name, last_name, email, phone, address, notes),
          therapist_profiles!inner(first_name, last_name, email, phone, bio, profile_pic),
          services!inner(name, description, service_base_price, minimum_duration)
        `)
        .eq('id', id)
        .single();

      if (bookingError) throw bookingError;

      // Transform the data
      const transformedBooking: Booking = {
        ...bookingData,
        customer_name: `${bookingData.customers.first_name} ${bookingData.customers.last_name}`,
        therapist_name: `${bookingData.therapist_profiles.first_name} ${bookingData.therapist_profiles.last_name}`,
        service_name: bookingData.services.name,
        customer_details: bookingData.customers,
        therapist_details: bookingData.therapist_profiles,
        service_details: bookingData.services,
      };

      setBooking(transformedBooking);

      // Fetch status history
      const { data: historyData, error: historyError } = await supabaseClient
        .from('booking_status_history')
        .select(`
          *,
          admin_users!inner(first_name, last_name)
        `)
        .eq('booking_id', id)
        .order('changed_at', { ascending: false });

      if (historyError) throw historyError;

      const transformedHistory = (historyData || []).map((item: any) => ({
        ...item,
        changed_by_name: item.admin_users ? `${item.admin_users.first_name} ${item.admin_users.last_name}` : 'System',
      }));

      setStatusHistory(transformedHistory);
    } catch (error) {
      console.error('Error fetching booking details:', error);
      message.error('Failed to load booking details');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      requested: 'orange',
      confirmed: 'blue',
      completed: 'green',
      cancelled: 'red',
      declined: 'red',
      timeout_reassigned: 'purple',
      seeking_alternate: 'orange',
    };
    return colors[status] || 'default';
  };

  const getPaymentStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      pending: 'orange',
      paid: 'green',
      refunded: 'red',
    };
    return colors[status] || 'default';
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!booking) return;

    setUpdating(true);
    try {
      // Update booking status
      const { error: bookingError } = await supabaseClient
        .from('bookings')
        .update({ status: newStatus })
        .eq('id', booking.id);

      if (bookingError) throw bookingError;

      // Add to status history
      const { error: historyError } = await supabaseClient
        .from('booking_status_history')
        .insert({
          booking_id: booking.id,
          status: newStatus,
          changed_by: identity?.id,
          notes: `Status changed to ${newStatus}`,
        });

      if (historyError) throw historyError;

      message.success(`Booking status updated to ${newStatus}`);
      fetchBookingDetails();
    } catch (error) {
      console.error('Error updating booking status:', error);
      message.error('Failed to update booking status');
    } finally {
      setUpdating(false);
    }
  };

  const handlePaymentStatusChange = async (newPaymentStatus: string) => {
    if (!booking) return;

    setUpdating(true);
    try {
      const { error } = await supabaseClient
        .from('bookings')
        .update({ payment_status: newPaymentStatus })
        .eq('id', booking.id);

      if (error) throw error;

      message.success(`Payment status updated to ${newPaymentStatus}`);
      fetchBookingDetails();
    } catch (error) {
      console.error('Error updating payment status:', error);
      message.error('Failed to update payment status');
    } finally {
      setUpdating(false);
    }
  };

  const handleEdit = () => {
    if (booking) {
      editForm.setFieldsValue({
        status: booking.status,
        payment_status: booking.payment_status,
        notes: booking.notes,
        price: booking.price,
        therapist_fee: booking.therapist_fee,
      });
      setShowEditDrawer(true);
    }
  };

  const handleEditSubmit = async (values: any) => {
    if (!booking) return;

    setUpdating(true);
    try {
      const { error } = await supabaseClient
        .from('bookings')
        .update({
          status: values.status,
          payment_status: values.payment_status,
          notes: values.notes,
          price: values.price,
          therapist_fee: values.therapist_fee,
        })
        .eq('id', booking.id);

      if (error) throw error;

      message.success('Booking updated successfully');
      setShowEditDrawer(false);
      fetchBookingDetails();
    } catch (error) {
      console.error('Error updating booking:', error);
      message.error('Failed to update booking');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <div>Loading booking details...</div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          message="Booking Not Found"
          description="The booking you're looking for doesn't exist or has been deleted."
          type="error"
          showIcon
        />
      </div>
    );
  }

  return (
    <RoleGuard requiredRole="admin">
      <div style={{ padding: 24 }}>
        {/* Header */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col span={12}>
            <Space>
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={() => list('bookings')}
              >
                Back to Bookings
              </Button>
              <Title level={3} style={{ margin: 0 }}>
                Booking #{booking.booking_id || booking.id.slice(0, 8)}
              </Title>
            </Space>
          </Col>
          <Col span={12} style={{ textAlign: 'right' }}>
            <Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={fetchBookingDetails}
                loading={loading}
              >
                Refresh
              </Button>
              <Button
                type="primary"
                icon={<EditOutlined />}
                onClick={handleEdit}
              >
                Edit Booking
              </Button>
            </Space>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          {/* Main Booking Information */}
          <Col span={16}>
            <Card title="Booking Details" style={{ marginBottom: 16 }}>
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Statistic
                    title="Status"
                    value={booking.status.replace('_', ' ').toUpperCase()}
                    valueStyle={{ color: getStatusColor(booking.status) }}
                    prefix={
                      <Tag color={getStatusColor(booking.status)}>
                        {booking.status.replace('_', ' ').toUpperCase()}
                      </Tag>
                    }
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="Payment Status"
                    value={booking.payment_status.toUpperCase()}
                    valueStyle={{ color: getPaymentStatusColor(booking.payment_status) }}
                    prefix={
                      <Tag color={getPaymentStatusColor(booking.payment_status)}>
                        {booking.payment_status.toUpperCase()}
                      </Tag>
                    }
                  />
                </Col>
              </Row>

              <Divider />

              <Descriptions column={2} size="small">
                <Descriptions.Item label="Service">
                  <Text strong>{booking.service_name}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Duration">
                  <Text>{booking.duration_minutes || booking.service_details?.minimum_duration || 60} minutes</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Date">
                  <Text>{dayjs(booking.booking_time).format('dddd, MMMM DD, YYYY')}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Time">
                  <Text>{dayjs(booking.booking_time).format('HH:mm')}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Price">
                  <Text strong style={{ color: '#52c41a' }}>
                    ${booking.price.toFixed(2)}
                  </Text>
                </Descriptions.Item>
                <Descriptions.Item label="Therapist Fee">
                  <Text>${booking.therapist_fee.toFixed(2)}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Address" span={2}>
                  <Text>{booking.address || 'No address provided'}</Text>
                </Descriptions.Item>
                {booking.notes && (
                  <Descriptions.Item label="Notes" span={2}>
                    <Text>{booking.notes}</Text>
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Card>

            {/* Customer Information */}
            <Card title="Customer Information" style={{ marginBottom: 16 }}>
              <Row gutter={[16, 16]} align="middle">
                <Col span={4}>
                  <Avatar size={64} icon={<UserOutlined />} />
                </Col>
                <Col span={20}>
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="Name">
                      <Text strong>{booking.customer_name}</Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="Email">
                      <Space>
                        <MailOutlined />
                        <Text>{booking.customer_email}</Text>
                      </Space>
                    </Descriptions.Item>
                    <Descriptions.Item label="Phone">
                      <Space>
                        <PhoneOutlined />
                        <Text>{booking.customer_phone || 'No phone provided'}</Text>
                      </Space>
                    </Descriptions.Item>
                    {booking.customer_details?.address && (
                      <Descriptions.Item label="Address">
                        <Space>
                          <EnvironmentOutlined />
                          <Text>{booking.customer_details.address}</Text>
                        </Space>
                      </Descriptions.Item>
                    )}
                  </Descriptions>
                </Col>
              </Row>
            </Card>

            {/* Therapist Information */}
            <Card title="Therapist Information" style={{ marginBottom: 16 }}>
              <Row gutter={[16, 16]} align="middle">
                <Col span={4}>
                  <Avatar 
                    size={64} 
                    src={booking.therapist_details?.profile_pic}
                    icon={<UserOutlined />} 
                  />
                </Col>
                <Col span={20}>
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="Name">
                      <Text strong>{booking.therapist_name}</Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="Email">
                      <Space>
                        <MailOutlined />
                        <Text>{booking.therapist_details?.email}</Text>
                      </Space>
                    </Descriptions.Item>
                    <Descriptions.Item label="Phone">
                      <Space>
                        <PhoneOutlined />
                        <Text>{booking.therapist_details?.phone || 'No phone provided'}</Text>
                      </Space>
                    </Descriptions.Item>
                    {booking.therapist_details?.bio && (
                      <Descriptions.Item label="Bio">
                        <Text>{booking.therapist_details.bio}</Text>
                      </Descriptions.Item>
                    )}
                  </Descriptions>
                </Col>
              </Row>
            </Card>
          </Col>

          {/* Sidebar Actions and History */}
          <Col span={8}>
            {/* Quick Actions */}
            <Card title="Quick Actions" style={{ marginBottom: 16 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  onClick={() => handleStatusChange('confirmed')}
                  disabled={booking.status === 'confirmed' || booking.status === 'completed'}
                  loading={updating}
                  block
                >
                  Confirm Booking
                </Button>
                <Button
                  icon={<CheckCircleOutlined />}
                  onClick={() => handleStatusChange('completed')}
                  disabled={booking.status === 'completed'}
                  loading={updating}
                  block
                >
                  Mark Complete
                </Button>
                <Button
                  danger
                  icon={<CloseCircleOutlined />}
                  onClick={() => handleStatusChange('cancelled')}
                  disabled={booking.status === 'cancelled'}
                  loading={updating}
                  block
                >
                  Cancel Booking
                </Button>
                <Button
                  icon={<EditOutlined />}
                  onClick={() => edit('bookings', booking.id)}
                  block
                >
                  Edit Booking
                </Button>
              </Space>
            </Card>

            {/* Payment Actions */}
            <Card title="Payment Status" style={{ marginBottom: 16 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Button
                  type="primary"
                  onClick={() => handlePaymentStatusChange('paid')}
                  disabled={booking.payment_status === 'paid'}
                  loading={updating}
                  block
                >
                  Mark as Paid
                </Button>
                <Button
                  onClick={() => handlePaymentStatusChange('pending')}
                  disabled={booking.payment_status === 'pending'}
                  loading={updating}
                  block
                >
                  Mark as Pending
                </Button>
                <Button
                  danger
                  onClick={() => handlePaymentStatusChange('refunded')}
                  disabled={booking.payment_status === 'refunded'}
                  loading={updating}
                  block
                >
                  Mark as Refunded
                </Button>
              </Space>
            </Card>

            {/* Status History */}
            <Card title="Status History">
              <Timeline>
                {statusHistory.map((item, index) => (
                  <Timeline.Item
                    key={item.id}
                    color={getStatusColor(item.status)}
                    dot={index === 0 ? <CheckCircleOutlined /> : undefined}
                  >
                    <Space direction="vertical" size="small">
                      <Text strong>
                        {item.status.replace('_', ' ').toUpperCase()}
                      </Text>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        {dayjs(item.changed_at).format('MMM DD, YYYY HH:mm')}
                      </Text>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        by {item.changed_by_name}
                      </Text>
                      {item.notes && (
                        <Text style={{ fontSize: '12px' }}>
                          {item.notes}
                        </Text>
                      )}
                    </Space>
                  </Timeline.Item>
                ))}
                {statusHistory.length === 0 && (
                  <Text type="secondary">No status changes recorded</Text>
                )}
              </Timeline>
            </Card>
          </Col>
        </Row>

        {/* Edit Drawer */}
        <Drawer
          title="Edit Booking"
          width={600}
          open={showEditDrawer}
          onClose={() => setShowEditDrawer(false)}
          footer={
            <Space>
              <Button onClick={() => setShowEditDrawer(false)}>
                Cancel
              </Button>
              <Button
                type="primary"
                onClick={() => editForm.submit()}
                loading={updating}
              >
                Save Changes
              </Button>
            </Space>
          }
        >
          <Form
            form={editForm}
            layout="vertical"
            onFinish={handleEditSubmit}
          >
            <Form.Item
              name="status"
              label="Status"
            >
              <Select>
                <Option value="requested">Requested</Option>
                <Option value="confirmed">Confirmed</Option>
                <Option value="completed">Completed</Option>
                <Option value="cancelled">Cancelled</Option>
                <Option value="declined">Declined</Option>
              </Select>
            </Form.Item>

            <Form.Item
              name="payment_status"
              label="Payment Status"
            >
              <Select>
                <Option value="pending">Pending</Option>
                <Option value="paid">Paid</Option>
                <Option value="refunded">Refunded</Option>
              </Select>
            </Form.Item>

            <Form.Item
              name="price"
              label="Price"
            >
              <Input prefix="$" type="number" step="0.01" />
            </Form.Item>

            <Form.Item
              name="therapist_fee"
              label="Therapist Fee"
            >
              <Input prefix="$" type="number" step="0.01" />
            </Form.Item>

            <Form.Item
              name="notes"
              label="Notes"
            >
              <Input.TextArea rows={4} />
            </Form.Item>
          </Form>
        </Drawer>
      </div>
    </RoleGuard>
  );
}; 