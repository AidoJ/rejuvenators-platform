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
} from '@ant-design/icons';
import { useGetIdentity, useNavigation } from '@refinedev/core';
import { supabaseClient } from '../../utility';
import { UserIdentity, canAccess } from '../../utils/roleUtils';
import { RoleGuard } from '../../components/RoleGuard';
import dayjs from 'dayjs';
import type { TableColumnsType } from 'antd';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

// Interfaces
interface BookingRecord {
  id: string;
  booking_time: string;
  status: string;
  payment_status: string;
  price: number;
  therapist_fee?: number;
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
        console.error('Therapist_profiles table error:', therapistsError);
      } else {
        console.log('Therapist_profiles table accessible, count:', therapistsCount);
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

      // Get first few booking records to see structure
      const { data: sampleBookings, error: sampleError } = await supabaseClient
        .from('bookings')
        .select('*')
        .limit(3);
      
      if (sampleError) {
        console.error('Sample bookings error:', sampleError);
      } else {
        console.log('Sample bookings:', sampleBookings);
      }

    } catch (error) {
      console.error('Debug error:', error);
    }
    
    console.log('=== END DEBUG ===');
  };

  useEffect(() => {
    if (identity) {
      debugDatabase(); // Debug first
      fetchData();
    }
  }, [identity]);

  useEffect(() => {
    applyFilters();
  }, [filters, bookings]);

  const fetchData = async () => {
    try {
      setLoading(true);
      await Promise.all([fetchBookings(), fetchTherapists()]);
    } catch (error) {
      console.error('Error fetching data:', error);
      message.error('Failed to load booking data');
    } finally {
      setLoading(false);
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
    }
  };

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
    }
  };

  const applyFilters = () => {
    let filtered = [...bookings];

    // Status filter
    if (filters.status) {
      filtered = filtered.filter(booking => booking.status === filters.status);
    }

    // Therapist filter
    if (filters.therapist_id) {
      filtered = filtered.filter(booking => booking.therapist_profiles?.id === filters.therapist_id);
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
    if (filters.payment_status) {
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
          booking.customer_email?.toLowerCase().includes(searchLower) ||
          booking.customer_phone?.includes(filters.search!) ||
          booking.id.toLowerCase().includes(searchLower) ||
          booking.therapist_profiles?.first_name?.toLowerCase().includes(searchLower) ||
          booking.therapist_profiles?.last_name?.toLowerCase().includes(searchLower) ||
          booking.services?.name?.toLowerCase().includes(searchLower) ||
          booking.address?.toLowerCase().includes(searchLower)
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
          : record.booker_name || `${record.first_name || ''} ${record.last_name || ''}`.trim() || 'Unknown';
        
        return (
          <div>
            <Text strong>{customerName}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {record.customers?.email || record.customer_email || 'No email'}
            </Text>
            {(record.customers?.phone || record.customer_phone) && (
              <div>
                <PhoneOutlined style={{ marginRight: 4, fontSize: '10px' }} />
                <Text type="secondary" style={{ fontSize: '10px' }}>
                  {record.customers?.phone || record.customer_phone}
                </Text>
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: 'Therapist',
      key: 'therapist',
      width: 150,
      render: (_, record) => (
        <div>
          {record.therapist_profiles ? (
            <>
              <Text strong>
                {record.therapist_profiles.first_name} {record.therapist_profiles.last_name}
              </Text>
              <br />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {record.therapist_profiles.email}
              </Text>
            </>
          ) : (
            <Tag color="orange">Unassigned</Tag>
          )}
        </div>
      ),
    },
    {
      title: 'Service & Time',
      key: 'service_time',
      width: 200,
      render: (_, record) => (
        <div>
          <Text strong>{record.services?.name || 'Unknown Service'}</Text>
          <br />
          <Text type="secondary">
            {dayjs(record.booking_time).format('MMM DD, YYYY')}
          </Text>
          <br />
          <Text type="secondary">
            <ClockCircleOutlined style={{ marginRight: 4 }} />
            {dayjs(record.booking_time).format('h:mm A')} 
            {record.duration_minutes && ` (${record.duration_minutes}min)`}
          </Text>
        </div>
      ),
    },
    {
      title: 'Location',
      dataIndex: 'address',
      key: 'address',
      width: 200,
      render: (address: string) => (
        <Tooltip title={address}>
          <div style={{ maxWidth: 180 }}>
            <EnvironmentOutlined style={{ marginRight: 4 }} />
            <Text ellipsis>{address || 'No address'}</Text>
          </div>
        </Tooltip>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: 120,
      render: (_, record) => (
        <div>
          <Tag 
            color={getStatusColor(record.status)} 
            icon={getStatusIcon(record.status)}
            style={{ marginBottom: 4 }}
          >
            {record.status.charAt(0).toUpperCase() + record.status.slice(1).replace('_', ' ')}
          </Tag>
          <br />
          <Tag 
            color={record.payment_status === 'paid' ? 'green' : record.payment_status === 'pending' ? 'orange' : 'red'}
            style={{ fontSize: '10px' }}
          >
            {record.payment_status}
          </Tag>
        </div>
      ),
    },
    {
      title: 'Price',
      key: 'price',
      width: 100,
      render: (_, record) => (
        <div>
          <Text strong>${record.price?.toFixed(2) || 'N/A'}</Text>
          {canAccess(userRole, 'canViewAllEarnings') && record.therapist_fee && (
            <>
              <br />
              <Text type="secondary" style={{ fontSize: '11px' }}>
                Fee: ${record.therapist_fee.toFixed(2)}
              </Text>
            </>
          )}
        </div>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space direction="vertical" size="small">
          <Space>
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => push(`/bookings/show/${record.id}`)}
              title="View Details"
            />
            {(canAccess(userRole, 'canEditAllBookings') || canAccess(userRole, 'canEditOwnBookings')) && (
              <Button
                size="small"
                type="primary"
                icon={<EditOutlined />}
                onClick={() => push(`/bookings/edit/${record.id}`)}
                title="Edit Booking"
              />
            )}
          </Space>
          
          {canAccess(userRole, 'canEditAllBookings') && (
            <Dropdown
              menu={{
                items: statusMenuItems.map(item => ({
                  ...item,
                  onClick: () => handleStatusChange(record.id, item.key),
                })),
              }}
              trigger={['click']}
            >
              <Button size="small" style={{ fontSize: '10px' }}>
                Change Status
              </Button>
            </Dropdown>
          )}
        </Space>
      ),
    },
  ];

  const rowSelection = canAccess(userRole, 'canEditAllBookings') ? {
    selectedRowKeys,
    onChange: setSelectedRowKeys,
  } : undefined;

  // Calculate summary stats
  const summaryStats = {
    total: filteredBookings.length,
    completed: filteredBookings.filter(b => b.status === 'completed').length,
    confirmed: filteredBookings.filter(b => b.status === 'confirmed').length,
    pending: filteredBookings.filter(b => b.status === 'requested').length,
    totalRevenue: filteredBookings
      .filter(b => b.status === 'completed')
      .reduce((sum, b) => sum + (b.price || 0), 0),
  };

  return (
    <RoleGuard requiredPermission="canViewBookingCalendar">
      <div style={{ padding: 24 }}>
        <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
          <Col>
            <Title level={2} style={{ margin: 0 }}>
              Booking Management
            </Title>
            <Text type="secondary">
              Manage and track all massage bookings
            </Text>
          </Col>
          <Col>
            <Space>
              <Button 
                icon={<CalendarOutlined />}
                onClick={() => push('/bookings/calendar')}
              >
                Calendar View
              </Button>
              <Button 
                icon={<ReloadOutlined />} 
                onClick={fetchData}
                loading={loading}
              >
                Refresh
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => window.open('https://rmmbookingplatform.netlify.app', '_blank')}
              >
                Create New Booking
              </Button>
            </Space>
          </Col>
        </Row>

        {/* Summary Statistics */}
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
                title="Revenue"
                value={summaryStats.totalRevenue}
                prefix={<DollarOutlined />}
                precision={2}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
        </Row>

        {/* Filters */}
        <Card style={{ marginBottom: 24 }}>
          <Row gutter={16} align="middle">
            <Col span={6}>
              <Input
                placeholder="Search customers, therapists, services..."
                prefix={<SearchOutlined />}
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                allowClear
              />
            </Col>
            <Col span={4}>
              <Select
                placeholder="Status"
                value={filters.status}
                onChange={(value) => setFilters({ ...filters, status: value })}
                allowClear
                style={{ width: '100%' }}
              >
                <Option value="requested">Requested</Option>
                <Option value="confirmed">Confirmed</Option>
                <Option value="completed">Completed</Option>
                <Option value="cancelled">Cancelled</Option>
                <Option value="declined">Declined</Option>
              </Select>
            </Col>
            <Col span={4}>
              <Select
                placeholder="Therapist"
                value={filters.therapist_id}
                onChange={(value) => setFilters({ ...filters, therapist_id: value })}
                allowClear
                style={{ width: '100%' }}
              >
                {therapists.map(therapist => (
                  <Option key={therapist.id} value={therapist.id}>
                    {therapist.first_name} {therapist.last_name}
                  </Option>
                ))}
              </Select>
            </Col>
            <Col span={6}>
              <RangePicker
                value={filters.date_range}
                onChange={(dates) => setFilters({ 
                  ...filters, 
                  date_range: dates ? [dates[0]!, dates[1]!] : undefined 
                })}
                style={{ width: '100%' }}
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
            rowSelection={rowSelection}
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
