import React from 'react';
import { useGetIdentity } from '@refinedev/core';
import { useParams, useNavigate } from '@refinedev/react-router-v6';
import { Card, Button, Space, Typography, message } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { EnhancedTherapistProfileForm } from '../../components';

const { Title } = Typography;

interface RouteParams {
  id?: string;
}

interface TherapistProfile {
  id: string;
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

export const TherapistProfilePage: React.FC = () => {
  const { id } = useParams<RouteParams>();
  const navigate = useNavigate();
  const { data: identity } = useGetIdentity();
  
  const profileId = id || identity?.therapist_profile_id;
  const isOwnProfile = !id || (identity?.therapist_profile_id && id === identity.therapist_profile_id);
  const isAdmin = identity?.role === 'admin' || identity?.role === 'super_admin';
  
  const handleSave = (profile: TherapistProfile) => {
    console.log('Profile saved:', profile);
    message.success('Profile updated successfully!');
    
    // Navigate back to therapist list if admin is editing another therapist
    if (isAdmin && !isOwnProfile) {
      navigate('/therapists');
    }
  };

  const handleBack = () => {
    if (isAdmin && !isOwnProfile) {
      navigate('/therapists');
    } else {
      navigate('/dashboard');
    }
  };
  
  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
          </div>

          <EnhancedTherapistProfileForm
            profileId={profileId}
            mode={profileId ? "edit" : "create"}
            onSave={handleSave}
          />
        </Space>
      </Card>
    </div>
  );
};
