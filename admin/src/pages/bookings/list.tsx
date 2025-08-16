import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Space,
  Button,
  Input,
  Select,
  DatePicker,
  Tag,
  Dropdown,
  Modal,
  message,
  Typography,
  Row,
  Col,
  Statistic,
  Badge,
  Tooltip,
  Popconfirm,
} from 'antd';
import {
  SearchOutlined,
  FilterOutlined,
  ExportOutlined,
  EditOutlined,
  EyeOutlined,
  UserOutlined,
  CalendarOutlined,
  DollarOutlined,
  PhoneOutlined,
  EnvironmentOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  MailOutlined,
  MoreOutlined,
} from '@ant-design/icons';
import { useGetIdentity, useNavigation } from '@refinedev/core';
import { supabaseClient } from '../../utility';
import { UserIdentity, canAccess, isTherapist } from '../../utils/roleUtils';
import { RoleGuard } from '../../components/RoleGuard';
import dayjs from 'dayjs';
import type { TableColumnsType } from 'antd';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;
const { Search } = Input;

// Interfaces
interface BookingRecord {
  id: string;
  booking_time: string;
  status: string;
  payment_status: string;
  price: number;
  therapist_fee?: number;
  therapist_id?: string;
  customer_id?: string;
  service_id?: string;
  address: string;
  notes?: string;
  duration_minutes?: number;
  customer_email?: string;
  customer_phone?: string;
  booker_name?: string;
  first_name?: string;
  last_name?: string;
  business_name?: string;
  room_number?: string;
  created_at: string;
  customers?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
  };
  therapist_profiles?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
  };
  services?: {
    id: string;
    name: string;
    description?: string;
  };
}

interface FilterState {
  status?: string;
  therapist_id?: string;
  date_range?: [dayjs.Dayjs, dayjs.Dayjs];
  search?: string;
  payment_status?: string;
}

interface BookingSummary {
  total: number;
  completed: number;
  confirmed: number;
  pending: number;
  cancelled: number;
  totalRevenue: number;
  totalFees: number;
}

interface Therapist {
  id: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
}

export const EnhancedBookingList: React.FC = () => {
  const { data: identity } = useGetIdentity<UserIdentity>();
  const { edit, show, push } = useNavigation();
  
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<BookingRecord[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [filters, setFilters] = useState<FilterState>({});
  const [summaryStats, setSummaryStats] = useState<BookingSummary>({
    total: 0,
    completed: 0,
    confirmed: 0,
    pending: 0,
    cancelled: 0,
    totalRevenue: 0,
    totalFees: 0,
  });
  
  const userRole = identity?.role;

  // Debug function to check database connection and tables
  const debugDatabase = async () => {
    console.log('=== DATABASE DEBUG ===');
    
    try {
      // Check if we can connect to bookings table
      const { count: bookingsCount, error: bookingsError } = await supabaseClient
        .from('bookings')
        .select('*', { count: 'exact', head: true });
      
      if (bookingsError) {
        console.error('Bookings table error:', bookingsError);
      } else {
        console.log('Bookings table accessible, count:', bookingsCount);
      }

      // Check customers table
      const { count: customersCount, error: customersError } = await supabaseClient
        .from('customers')
        .select('*', { count: 'exact', head: true });
      
      if (customersError) {
        console.error('Customers table error:', customersError);
      } else {
        console.log('Customers table accessible, count:', customersCount);
      }

      // Check therapist_profiles table
      const { count: therapistsCount, error: therapistsError } = await supabaseClient
        .from('therapist_profiles')
        .select('*', { count: 'exact', head: true });
      
      if (therapistsError) {
        console.error('Therapist profiles table error:', therapistsError);
      } else {
        console.log('Therapist profiles table accessible, count:', therapistsCount);
      }

      // Check services table
      const { count: servicesCount, error: servicesError } = await supabaseClient
        .from('services')
        .select('*', { count: 'exact', head: true });
      
      if (servicesError) {
        console.error('Services table error:', servicesError);
      } else {
        console.log('Services table accessible, count:', servicesCount);
      }

    } catch (error) {
      console.error('Database connection error:', error);
    }
  };

  useEffect(() => {
    if (identity) {
      debugDatabase();
      fetchBookings();
      fetchTherapists();
    }
  }, [identity]);

  useEffect(() => {
    applyFilters();
  }, [bookings, filters]);

  // Calculate summary statistics whenever filtered bookings change
  useEffect(() => {
    if (filteredBookings.length > 0) {
      const completed = filteredBookings.filter(item => item.status === 'completed');
      const confirmed = filteredBookings.filter(item => item.status === 'confirmed');
      const pending = filteredBookings.filter(item => item.status === 'requested');
      const cancelled = filteredBookings.filter(item => item.status === 'cancelled');
      
      const totalRevenue = completed.reduce((sum, item) => sum + (parseFloat(item.price?.toString() || '0') || 0), 0);
      const totalFees = completed.reduce((sum, item) => sum + (parseFloat(item.therapist_fee?.toString() || '0') || 0), 0);

      setSummaryStats({
        total: filteredBookings.length,
        completed: completed.length,
        confirmed: confirmed.length,
        pending: pending.length,
        cancelled: cancelled.length,
        totalRevenue,
        totalFees,
      });
    } else {
      setSummaryStats({
        total: 0,
        completed: 0,
        confirmed: 0,
        pending: 0,
        cancelled: 0,
        totalRevenue: 0,
        totalFees: 0,
      });
    }
  }, [filteredBookings]);

  const fetchTherapists = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('therapist_profiles')
        .select('id, first_name, last_name, is_active')
        .eq('is_active', true)
        .order('first_name');

      if (error) throw error;
      setTherapists(data || []);
    } catch (error) {
      console.error('Error fetching therapists:', error);
      message.error('Failed to load therapist data');
    }
  };

  const fetchBookings = async () => {
    try {
      console.log('Fetching bookings...');
      
      // First, let's just get basic bookings data
      let query = supabaseClient
        .from('bookings')
        .select('*')
        .order('booking_time', { ascending: false });

      // If therapist, only show their bookings
      if (userRole === 'therapist' && identity?.id) {
        const { data: therapistProfile } = await supabaseClient
          .from('therapist_profiles')
          .select('id')
          .eq('user_id', identity.id)
          .single();
        
        if (therapistProfile) {
          query = query.eq('therapist_id', therapistProfile.id);
        }
      }

      const { data: bookingsData, error: bookingsError } = await query;
      
      if (bookingsError) {
        console.error('Error fetching bookings:', bookingsError);
        throw bookingsError;
      }

      console.log('Raw bookings data:', bookingsData);

      if (!bookingsData || bookingsData.length === 0) {
        console.log('No bookings found');
        setBookings([]);
        return;
      }

      // Now let's enrich the data with related information
      const enrichedBookings = await Promise.all(
        bookingsData.map(async (booking) => {
          let enrichedBooking = { ...booking };

          // Get customer data
          if (booking.customer_id) {
            try {
              const { data: customer } = await supabaseClient
                .from('customers')
                .select('id, first_name, last_name, email, phone')
                .eq('id', booking.customer_id)
                .single();
              
              if (customer) {
                enrichedBooking.customers = customer;
              }
            } catch (customerError) {
              console.log('Customer not found for booking:', booking.id);
            }
          }

          // Get therapist data
          if (booking.therapist_id) {
            try {
              const { data: therapist } = await supabaseClient
                .from('therapist_profiles')
                .select('id, first_name, last_name, email, phone')
                .eq('id', booking.therapist_id)
                .single();
              
              if (therapist) {
                enrichedBooking.therapist_profiles = therapist;
              }
            } catch (therapistError) {
              console.log('Therapist not found for booking:', booking.id);
            }
          }

          // Get service data
          if (booking.service_id) {
            try {
              const { data: service } = await supabaseClient
                .from('services')
                .select('id, name, description')
                .eq('id', booking.service_id)
                .single();
              
              if (service) {
                enrichedBooking.services = service;
              }
            } catch (serviceError) {
              console.log('Service not found for booking:', booking.id);
            }
          }

          return enrichedBooking;
        })
      );

      console.log('Enriched bookings:', enrichedBookings);
      setBookings(enrichedBookings);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      message.error(`Failed to load bookings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...bookings];

    // Status filter
    if (filters.status && filters.status !== 'all') {
      filtered = filtered.filter(booking => booking.status === filters.status);
    }

    // Therapist filter
    if (filters.therapist_id && filters.therapist_id !== 'all') {
      filtered = filtered.filter(booking => booking.therapist_id === filters.therapist_id);
    }

    // Date range filter
    if (filters.date_range) {
      const [start, end] = filters.date_range;
      filtered = filtered.filter(booking => {
        const bookingDate = dayjs(booking.booking_time);
        return bookingDate.isAfter(start.startOf('day')) && bookingDate.isBefore(end.endOf('day'));
      });
    }

    // Payment status filter
    if (filters.payment_status && filters.payment_status !== 'all') {
      filtered = filtered.filter(booking => booking.payment_status === filters.payment_status);
    }

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(booking => {
        const customerName = booking.customers 
          ? `${booking.customers.first_name} ${booking.customers.last_name}`
          : booking.booker_name || `${booking.first_name || ''} ${booking.last_name || ''}`.trim();
        
        return (
          customerName.toLowerCase().includes(searchLower) ||
          (booking.customer_email || '').toLowerCase().includes(searchLower) ||
          (booking.customer_phone || '').includes(filters.search) ||
          booking.id.toLowerCase().includes(searchLower) ||
          (booking.therapist_profiles?.first_name || '').toLowerCase().includes(searchLower) ||
          (booking.therapist_profiles?.last_name || '').toLowerCase().includes(searchLower) ||
          (booking.services?.name || '').toLowerCase().includes(searchLower) ||
          (booking.address || '').toLowerCase().includes(searchLower)
        );
      });
    }

    setFilteredBookings(filtered);
  };

  const handleStatusChange = async (bookingId: string, newStatus: string) => {
    try {
      const { error } = await supabaseClient
        .from('bookings')
        .update({ status: newStatus })
        .eq('id', bookingId);

      if (error) throw error;

      message.success(`Booking status updated to ${newStatus}`);
      fetchBookings(); // Refresh data
    } catch (error) {
      console.error('Error updating status:', error);
      message.error('Failed to update booking status');
    }
  };

  const handleBulkStatusChange = async (newStatus: string) => {
    try {
      const { error } = await supabaseClient
        .from('bookings')
        .update({ status: newStatus })
        .in('id', selectedRowKeys);

      if (error) throw error;

      message.success(`Updated ${selectedRowKeys.length} bookings to ${newStatus}`);
      setSelectedRowKeys([]);
      fetchBookings();
    } catch (error) {
      console.error('Error updating bookings:', error);
      message.error('Failed to update bookings');
    }
  };

  const getStatusColor = (status: string) => {
    const colors = {
      requested: 'orange',
      confirmed: 'blue',
      completed: 'green',
      cancelled: 'red',
      declined: 'red',
      timeout_reassigned: 'purple',
      seeking_alternate: 'yellow',
    };
    return colors[status as keyof typeof colors] || 'default';
  };

  const getStatusIcon = (status: string) => {
    const icons = {
      requested: <ClockCircleOutlined />,
      confirmed: <CalendarOutlined />,
      completed: <CheckCircleOutlined />,
      cancelled: <ExclamationCircleOutlined />,
      declined: <ExclamationCircleOutlined />,
    };
    return icons[status as keyof typeof icons] || <ClockCircleOutlined />;
  };

  const getPaymentStatusColor = (status: string) => {
    const colors = {
      pending: 'orange',
      paid: 'green',
      refunded: 'red',
    };
    return colors[status as keyof typeof colors] || 'default';
  };

  const statusMenuItems = [
    { key: 'requested', label: 'Mark as Requested', icon: <ClockCircleOutlined /> },
    { key: 'confirmed', label: 'Mark as Confirmed', icon: <CalendarOutlined /> },
    { key: 'completed', label: 'Mark as Completed', icon: <CheckCircleOutlined /> },
    { key: 'cancelled', label: 'Mark as Cancelled', icon: <ExclamationCircleOutlined /> },
  ];

  const columns: TableColumnsType<BookingRecord> = [
    {
      title: 'Customer',
      key: 'customer',
      width: 200,
      render: (_, record) => {
        const customerName = record.customers 
          ? `${record.customers.first_name} ${record.customers.last_name}`
          : record.booker_name || `${record.first_name || ''} ${record.last_name || ''}`.trim() || 'Unknown Customer';
        
        return (
          <Space direction="vertical" size="small">
            <Text strong>{customerName}</Text>
            <Space size="small">
              {(record.customers?.email || record.customer_email) && (
                <Tooltip title={record.customers?.email || record.customer_email}>
                  <MailOutlined style={{ color: '#1890ff' }} />
                </Tooltip>
              )}
              {(record.customers?.phone || record.customer_phone) && (
                <Tooltip title={record.customers?.phone || record.customer_phone}>
                  <PhoneOutlined style={{ color: '#52c41a' }} />
                </Tooltip>
              )}
            </Space>
          </Space>
        );
      },
    },
    {
      title: 'Service',
      dataIndex: 'service_name',
      key: 'service_name',
      render: (_, record) => (
        <Text>{record.services?.name || 'Unknown Service'}</Text>
      ),
    },
    {
      title: 'Therapist',
      dataIndex: 'therapist_name',
      key: 'therapist_name',
      render: (_, record) => (
        <Text>
          {record.therapist_profiles 
            ? `${record.therapist_profiles.first_name} ${record.therapist_profiles.last_name}`
            : 'Unassigned'}
        </Text>
      ),
    },
    {
      title: 'Date & Time',
      dataIndex: 'booking_time',
      key: 'booking_time',
      render: (time: string) => (
        <Space direction="vertical" size="small">
          <Text>{dayjs(time).format('MMM DD, YYYY')}</Text>
          <Text type="secondary">{dayjs(time).format('HH:mm')}</Text>
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={getStatusColor(status)} icon={getStatusIcon(status)}>
          {status.replace('_', ' ').toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Payment',
      dataIndex: 'payment_status',
      key: 'payment_status',
      render: (status: string) => (
        <Tag color={getPaymentStatusColor(status)}>
          {status.toUpperCase()}
        </Tag>
      ),
    },
    // ONLY change column title/data for therapists, keep admin view unchanged
    {
      title: isTherapist(userRole) ? 'Fees' : 'Price',
      dataIndex: isTherapist(userRole) ? 'therapist_fee' : 'price',
      key: isTherapist(userRole) ? 'therapist_fee' : 'price',
      render: (amount: number) => (
        <Text strong style={{ color: '#52c41a' }}>
          ${amount?.toFixed(2) || '0.00'}
        </Text>
      ),
    },
    // Only show "Therapist Fee" column for admins (not therapists) - UNCHANGED from original
    ...(canAccess(userRole, 'canViewAllEarnings') && !isTherapist(userRole) ? [{
      title: 'Therapist Fee',
      dataIndex: 'therapist_fee',
      key: 'therapist_fee',
      render: (fee: number) => (
        <Text style={{ color: '#fa541c' }}>
          {fee ? `$${fee.toFixed(2)}` : '-'}
        </Text>
      ),
    }] : []),
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Tooltip title="View Details">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => show('bookings', record.id)}
            />
          </Tooltip>
          <Tooltip title="Edit Booking">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => edit('bookings', record.id)}
            />
          </Tooltip>
          {canAccess(userRole, 'canEditAllBookings') && (
            <Dropdown
              menu={{
                items: statusMenuItems.map(item => ({
                  ...item,
                  onClick: () => handleStatusChange(record.id, item.key),
                  disabled: record.status === item.key,
                })),
              }}
            >
              <Button type="text" icon={<MoreOutlined />} />
            </Dropdown>
          )}
        </Space>
      ),
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(newSelectedRowKeys);
    },
  };

  return (
    <RoleGuard requiredPermission="canViewAllBookings">
      <div style={{ padding: 24 }}>
        {/* Header */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col span={12}>
            <Title level={3}>Bookings</Title>
          </Col>
          <Col span={12} style={{ textAlign: 'right' }}>
            <Space>
              <Button 
                icon={<ReloadOutlined />} 
                onClick={fetchBookings}
                loading={loading}
              >
                Refresh
              </Button>
              {canAccess(userRole, 'canCreateBookings') && (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  href="https://your-booking-platform-url.com"
                  target="_blank"
                >
                  New Booking
                </Button>
              )}
            </Space>
          </Col>
        </Row>

        {/* Summary Statistics - ONLY change for therapists */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="Total Bookings"
                value={summaryStats.total}
                prefix={<CalendarOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Completed"
                value={summaryStats.completed}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Confirmed"
                value={summaryStats.confirmed}
                prefix={<CalendarOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title={isTherapist(userRole) ? "Total Fees" : "Revenue"}
                value={isTherapist(userRole) ? summaryStats.totalFees : summaryStats.totalRevenue}
                prefix={<DollarOutlined />}
                precision={2}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
        </Row>

        {/* Filters */}
        <Card style={{ marginBottom: 16 }}>
          <Row gutter={[16, 16]} align="middle">
            <Col span={6}>
              <Search
                placeholder="Search bookings..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                onSearch={() => applyFilters()}
                allowClear
              />
            </Col>
            <Col span={4}>
              <Select
                placeholder="Status"
                value={filters.status}
                onChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
                style={{ width: '100%' }}
                allowClear
              >
                <Option value="all">All Status</Option>
                <Option value="requested">Requested</Option>
                <Option value="confirmed">Confirmed</Option>
                <Option value="completed">Completed</Option>
                <Option value="cancelled">Cancelled</Option>
                <Option value="declined">Declined</Option>
              </Select>
            </Col>
            <Col span={4}>
              <Select
                placeholder="Payment Status"
                value={filters.payment_status}
                onChange={(value) => setFilters(prev => ({ ...prev, payment_status: value }))}
                style={{ width: '100%' }}
                allowClear
              >
                <Option value="all">All Payment</Option>
                <Option value="pending">Pending</Option>
                <Option value="paid">Paid</Option>
                <Option value="refunded">Refunded</Option>
              </Select>
            </Col>
            <Col span={6}>
              <RangePicker
                style={{ width: '100%' }}
                onChange={(dates) => setFilters(prev => ({ 
                  ...prev, 
                  date_range: dates ? [dates[0]!, dates[1]!] : undefined 
                }))}
              />
            </Col>
            <Col span={4}>
              <Button
                onClick={() => setFilters({})}
                style={{ width: '100%' }}
              >
                Clear Filters
              </Button>
            </Col>
          </Row>

          {/* Bulk Actions */}
          {selectedRowKeys.length > 0 && canAccess(userRole, 'canEditAllBookings') && (
            <Row style={{ marginTop: 16, padding: '12px', backgroundColor: '#f0f9ff', borderRadius: '6px' }}>
              <Col span={24}>
                <Space>
                  <Text strong>{selectedRowKeys.length} bookings selected</Text>
                  <Dropdown
                    menu={{
                      items: statusMenuItems.map(item => ({
                        ...item,
                        onClick: () => handleBulkStatusChange(item.key),
                      })),
                    }}
                  >
                    <Button type="primary" size="small">
                      Bulk Status Change
                    </Button>
                  </Dropdown>
                  <Button 
                    size="small" 
                    onClick={() => setSelectedRowKeys([])}
                  >
                    Clear Selection
                  </Button>
                </Space>
              </Col>
            </Row>
          )}
        </Card>

        {/* Bookings Table */}
        <Card>
          <Table<BookingRecord>
            columns={columns}
            dataSource={filteredBookings}
            rowKey="id"
            loading={loading}
            rowSelection={canAccess(userRole, 'canEditAllBookings') ? rowSelection : undefined}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => 
                `${range[0]}-${range[1]} of ${total} bookings`,
            }}
            scroll={{ x: 1200 }}
            size="small"
          />
        </Card>
      </div>
    </RoleGuard>
  );
};
