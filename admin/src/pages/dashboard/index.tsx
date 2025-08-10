import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Col, 
  Row, 
  Statistic, 
  Table, 
  Tag, 
  Typography, 
  Spin,
  DatePicker,
  Select,
  Space,
  Button
} from 'antd';
import {
  DollarOutlined,
  CalendarOutlined,
  UserOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  PercentageOutlined,
  TeamOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { useGetIdentity } from '@refinedev/core';
import { supabaseClient } from '../../utility';
import dayjs, { Dayjs } from 'dayjs';

// Import role utilities
import { UserIdentity, canAccess, isSuperAdmin, isAdmin, isTherapist, getRoleName, getRoleColor } from '../../utils/roleUtils';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

interface BookingStats {
  totalBookings: number;
  totalRevenue: number;
  totalTherapistFees: number;
  totalNetMargin: number;
  activeTherapists: number;
  completedBookings: number;
  confirmedBookings: number;
  pendingBookings: number;
  cancelledBookings: number;
  averageBookingValue: number;
  conversionRate: number;
}

interface RecentBooking {
  id: string;
  customer_name: string;
  therapist_name: string;
  service_name: string;
  booking_time: string;
  status: string;
  price: number;
  therapist_fee?: number;
}

interface DateRange {
  start: Dayjs;
  end: Dayjs;
}

// Preset date range options
const DATE_PRESETS = {
  today: { label: 'Today', days: 0 },
  week: { label: 'Last 7 Days', days: 7 },
  month: { label: 'Last 30 Days', days: 30 },
  quarter: { label: 'Last 90 Days', days: 90 },
  year: { label: 'Last 365 Days', days: 365 },
  currentWeek: { label: 'This Week', type: 'week' },
  currentMonth: { label: 'This Month', type: 'month' },
  currentQuarter: { label: 'This Quarter', type: 'quarter' },
  currentYear: { label: 'This Year', type: 'year' }
};

export const Dashboard: React.FC = () => {
  const { data: identity } = useGetIdentity<UserIdentity>();
  const [stats, setStats] = useState<BookingStats | null>(null);
  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Date range state - default to current month
  const [dateRange, setDateRange] = useState<DateRange>({
    start: dayjs().startOf('month'),
    end: dayjs().endOf('month')
  });
  const [selectedPreset, setSelectedPreset] = useState<string>('currentMonth');

  const userRole = identity?.role;

  useEffect(() => {
    if (identity) {
      fetchDashboardData();
    }
  }, [identity, dateRange]);

  const handlePresetChange = (preset: string) => {
    setSelectedPreset(preset);
    const now = dayjs();
    let newRange: DateRange;

    switch (preset) {
      case 'today':
        newRange = {
          start: now.startOf('day'),
          end: now.endOf('day')
        };
        break;
      case 'week':
        newRange = {
          start: now.subtract(7, 'days').startOf('day'),
          end: now.endOf('day')
        };
        break;
      case 'month':
        newRange = {
          start: now.subtract(30, 'days').startOf('day'),
          end: now.endOf('day')
        };
        break;
      case 'quarter':
        newRange = {
          start: now.subtract(90, 'days').startOf('day'),
          end: now.endOf('day')
        };
        break;
      case 'year':
        newRange = {
          start: now.subtract(365, 'days').startOf('day'),
          end: now.endOf('day')
        };
        break;
      case 'currentWeek':
        newRange = {
          start: now.startOf('week'),
          end: now.endOf('week')
        };
        break;
      case 'currentMonth':
        newRange = {
          start: now.startOf('month'),
          end: now.endOf('month')
        };
        break;
      case 'currentQuarter':
        const quarterStart = now.startOf('month').subtract((now.month() % 3), 'month');
        const quarterEnd = quarterStart.add(2, 'month').endOf('month');
        newRange = {
          start: quarterStart,
          end: quarterEnd
        };
        break;
      case 'currentYear':
        newRange = {
          start: now.startOf('year'),
          end: now.endOf('year')
        };
        break;
      default:
        newRange = {
          start: now.startOf('month'),
          end: now.endOf('month')
        };
    }
    
    setDateRange(newRange);
  };

  const handleCustomDateRange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    if (dates && dates[0] && dates[1]) {
      setDateRange({
        start: dates[0].startOf('day'),
        end: dates[1].endOf('day')
      });
      setSelectedPreset('custom');
    }
  };

  const calculateMargin = (revenue: number, therapistFees: number): number => {
    if (revenue === 0) return 0;
    return ((revenue - therapistFees) / revenue) * 100;
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Build base query with role-based filtering
      let bookingsQuery = supabaseClient
        .from('bookings')
        .select(`
          *,
          therapist_profiles!bookings_therapist_id_fkey(first_name, last_name),
          customers(first_name, last_name),
          services(name)
        `)
        .gte('booking_time', dateRange.start.toISOString())
        .lte('booking_time', dateRange.end.toISOString());

      // If therapist, only show their bookings
      if (isTherapist(userRole) && identity?.id) {
        // Get therapist profile ID first
        const { data: therapistProfile } = await supabaseClient
          .from('therapist_profiles')
          .select('id')
          .eq('user_id', identity.id)
          .single();
        
        if (therapistProfile) {
          bookingsQuery = bookingsQuery.eq('therapist_id', therapistProfile.id);
        }
      }

      const { data: bookings, error } = await bookingsQuery;

      if (error) {
        console.error('Error fetching bookings:', error);
        return;
      }

      // Calculate statistics for the selected date range
      const completedBookings = bookings?.filter(b => b.status === 'completed') || [];
      const confirmedBookings = bookings?.filter(b => b.status === 'confirmed') || [];
      const pendingBookings = bookings?.filter(b => b.status === 'requested') || [];
      const cancelledBookings = bookings?.filter(b => b.status === 'cancelled') || [];

      // Calculate revenue (only from completed bookings)
      const totalRevenue = completedBookings.reduce((sum, b) => sum + (parseFloat(b.price) || 0), 0);

      // Calculate therapist fees (only from completed bookings)
      const totalTherapistFees = completedBookings.reduce((sum, b) => sum + (parseFloat(b.therapist_fee) || 0), 0);

      // Calculate additional metrics
      const totalNetMargin = calculateMargin(totalRevenue, totalTherapistFees);
      const averageBookingValue = completedBookings.length > 0 ? totalRevenue / completedBookings.length : 0;
      const conversionRate = bookings && bookings.length > 0 ? (completedBookings.length / bookings.length) * 100 : 0;

      // Get active therapists count (admin only)
      let activeTherapists = 0;
      if (canAccess(userRole, 'canViewAllTherapists')) {
        const { data: therapists } = await supabaseClient
          .from('therapist_profiles')
          .select('id')
          .eq('is_active', true);
        activeTherapists = therapists?.length || 0;
      }

      const dashboardStats: BookingStats = {
        totalBookings: bookings?.length || 0,
        totalRevenue,
        totalTherapistFees,
        totalNetMargin,
        activeTherapists,
        completedBookings: completedBookings.length,
        confirmedBookings: confirmedBookings.length,
        pendingBookings: pendingBookings.length,
        cancelledBookings: cancelledBookings.length,
        averageBookingValue,
        conversionRate
      };

      // Prepare recent bookings (sorted by most recent)
      const recent = bookings
        ?.sort((a, b) => dayjs(b.booking_time).unix() - dayjs(a.booking_time).unix())
        .slice(0, 10)
        .map(booking => ({
          id: booking.id,
          customer_name: booking.customers 
            ? `${booking.customers.first_name} ${booking.customers.last_name}`
            : booking.first_name && booking.last_name 
              ? `${booking.first_name} ${booking.last_name}`
              : booking.booker_name || 'Unknown Customer',
          therapist_name: booking.therapist_profiles 
            ? `${booking.therapist_profiles.first_name} ${booking.therapist_profiles.last_name}`
            : 'Unassigned',
          service_name: booking.services?.name || 'Unknown Service',
          booking_time: booking.booking_time,
          status: booking.status,
          price: parseFloat(booking.price) || 0,
          therapist_fee: parseFloat(booking.therapist_fee) || 0
        })) || [];

      setStats(dashboardStats);
      setRecentBookings(recent);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'green';
      case 'confirmed': return 'blue';
      case 'requested': return 'orange';
      case 'cancelled': return 'red';
      case 'declined': return 'red';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircleOutlined />;
      case 'confirmed': return <CalendarOutlined />;
      case 'requested': return <ClockCircleOutlined />;
      default: return <ExclamationCircleOutlined />;
    }
  };

  const recentBookingsColumns = [
    {
      title: 'Customer',
      dataIndex: 'customer_name',
      key: 'customer_name',
      render: (name: string) => <Text strong>{name}</Text>
    },
    {
      title: 'Therapist',
      dataIndex: 'therapist_name',
      key: 'therapist_name',
    },
    {
      title: 'Service',
      dataIndex: 'service_name',
      key: 'service_name',
    },
    {
      title: 'Date & Time',
      dataIndex: 'booking_time',
      key: 'booking_time',
      render: (time: string) => (
        <div>
          <div>{dayjs(time).format('MMM DD, YYYY')}</div>
          <Text type="secondary">{dayjs(time).format('h:mm A')}</Text>
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={getStatusColor(status)} icon={getStatusIcon(status)}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Tag>
      ),
    },
    {
      title: 'Price',
      dataIndex: 'price',
      key: 'price',
      render: (price: number) => `$${price.toFixed(2)}`,
    },
    ...(canAccess(userRole, 'canViewAllEarnings') ? [{
      title: 'Therapist Fee',
      dataIndex: 'therapist_fee',
      key: 'therapist_fee',
      render: (fee: number) => fee ? `$${fee.toFixed(2)}` : '-',
    }] : []),
  ];

  const formatDateRange = () => {
    if (selectedPreset !== 'custom') {
      return DATE_PRESETS[selectedPreset as keyof typeof DATE_PRESETS]?.label || 'Custom Range';
    }
    return `${dateRange.start.format('MMM DD, YYYY')} - ${dateRange.end.format('MMM DD, YYYY')}`;
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <Spin size="large" />
      </div>
    );
  }

  // Show loading if no identity yet
  if (!identity) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <Title level={2}>
              {isTherapist(userRole) 
                ? `Welcome back, ${identity?.first_name || identity?.name || 'Therapist'}!` 
                : `Rejuvenators Dashboard - ${getRoleName(userRole)}`
              }
            </Title>
            <Text type="secondary">
              {isTherapist(userRole) 
                ? 'Here\'s an overview of your bookings and performance'
                : 'Overview of your massage booking business'
              }
            </Text>
            <div style={{ marginTop: 8 }}>
              <Text strong>Period: </Text>
              <Text>{formatDateRange()}</Text>
            </div>
          </div>
          
          {/* Date Range Controls */}
          <Card size="small" style={{ minWidth: 400 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text strong>Quick Select:</Text>
                <Select
                  value={selectedPreset}
                  onChange={handlePresetChange}
                  style={{ width: '100%', marginTop: 4 }}
                >
                  {Object.entries(DATE_PRESETS).map(([key, value]) => (
                    <Option key={key} value={key}>{value.label}</Option>
                  ))}
                </Select>
              </div>
              
              <div>
                <Text strong>Custom Range:</Text>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <RangePicker
                    value={selectedPreset === 'custom' ? [dateRange.start, dateRange.end] : null}
                    onChange={handleCustomDateRange}
                    style={{ flex: 1 }}
                  />
                  <Button 
                    icon={<ReloadOutlined />} 
                    onClick={fetchDashboardData}
                    loading={loading}
                  >
                    Refresh
                  </Button>
                </div>
              </div>
            </Space>
          </Card>
        </div>
      </div>

      {/* Key Statistics */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Bookings"
              value={stats?.totalBookings || 0}
              prefix={<CalendarOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Revenue"
              value={stats?.totalRevenue || 0}
              prefix={<DollarOutlined />}
              precision={2}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Avg Booking Value"
              value={stats?.averageBookingValue || 0}
              prefix={<DollarOutlined />}
              precision={2}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title={canAccess(userRole, 'canViewAllTherapists') ? "Active Therapists" : "Your Completed"}
              value={canAccess(userRole, 'canViewAllTherapists') ? stats?.activeTherapists || 0 : stats?.completedBookings || 0}
              prefix={canAccess(userRole, 'canViewAllTherapists') ? <UserOutlined /> : <CheckCircleOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Admin-specific Statistics */}
      {canAccess(userRole, 'canViewAllEarnings') && (
        <>
          {/* Therapist Fees and Margins */}
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={8}>
              <Card>
                <Statistic
                  title="Total Therapist Fees"
                  value={stats?.totalTherapistFees || 0}
                  prefix={<TeamOutlined />}
                  precision={2}
                  valueStyle={{ color: '#fa541c' }}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic
                  title="Net Margin"
                  value={stats?.totalNetMargin || 0}
                  prefix={<PercentageOutlined />}
                  precision={1}
                  suffix="%"
                  valueStyle={{ 
                    color: (stats?.totalNetMargin || 0) >= 50 ? '#52c41a' : 
                           (stats?.totalNetMargin || 0) >= 30 ? '#fa8c16' : '#ff4d4f' 
                  }}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic
                  title="Conversion Rate"
                  value={stats?.conversionRate || 0}
                  prefix={<PercentageOutlined />}
                  precision={1}
                  suffix="%"
                  valueStyle={{ color: '#fa8c16' }}
                />
              </Card>
            </Col>
          </Row>
        </>
      )}

      {/* Booking Status Overview */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Completed"
              value={stats?.completedBookings || 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Confirmed"  
              value={stats?.confirmedBookings || 0}
              prefix={<CalendarOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Pending"
              value={stats?.pendingBookings || 0}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Cancelled"
              value={stats?.cancelledBookings || 0}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Recent Bookings */}
      <Card title={`Bookings in Selected Period (${stats?.totalBookings || 0} total)`} style={{ marginBottom: 24 }}>
        <Table
          dataSource={recentBookings}
          columns={recentBookingsColumns}
          rowKey="id"
          pagination={{ 
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} bookings`
          }}
          size="middle"
        />
      </Card>
    </div>
  );
};
