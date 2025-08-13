import React, { useState, useEffect } from 'react';
import { useGetIdentity } from '@refinedev/core';
import { useNavigate } from 'react-router-dom';
import { message, Spin, Alert } from 'antd';
import { supabaseClient } from '../../utility';
import { EnhancedTherapistProfileForm } from '../../components';
import { UserIdentity } from '../../utils/roleUtils';

interface TherapistProfile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  home_address?: string;
  latitude?: number;
  longitude?: number;
  address_verified?: boolean;
  service_radius_km?: number;
  bio?: string;
  gender?: string;
  years_experience?: number;
  is_active?: boolean;
}

const TherapistProfilePage: React.FC = () => {
  const { data: identity, isLoading: identityLoading } = useGetIdentity<UserIdentity>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!identityLoading && identity) {
      findTherapistProfile();
    }
  }, [identity, identityLoading]);

  const findTherapistProfile = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!identity?.id) {
        throw new Error('User not authenticated');
      }

      // Find therapist profile by user_id
      const { data: profile, error: profileError } = await supabaseClient
        .from('therapist_profiles')
        .select('id')
        .eq('user_id', identity.id)
        .single();

      if (profileError) {
        if (profileError.code === 'PGRST116') {
          // No profile found, need to create one
          setProfileId('new');
        } else {
          throw profileError;
        }
      } else {
        setProfileId(profile.id);
      }
    } catch (err: any) {
      console.error('Error finding therapist profile:', err);
      setError(err.message || 'Failed to load therapist profile');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSave = async (savedProfile: TherapistProfile) => {
    try {
      message.success('Profile saved successfully!');
      
      // If this was a new profile, update the profileId
      if (profileId === 'new') {
        setProfileId(savedProfile.id);
      }

      // Optionally refresh or navigate somewhere
      // navigate('/dashboard');
    } catch (error) {
      console.error('Error handling profile save:', error);
      message.error('Error saving profile');
    }
  };

  const createNewProfile = async (profileData: any) => {
    try {
      const newProfile = {
        ...profileData,
        user_id: identity?.id,
        is_active: true
      };

      const { data, error } = await supabaseClient
        .from('therapist_profiles')
        .insert([newProfile])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating profile:', error);
      throw error;
    }
  };

  if (identityLoading || loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '400px' 
      }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        message="Error Loading Profile"
        description={error}
        type="error"
        showIcon
        style={{ margin: '24px' }}
        action={
          <button onClick={() => window.location.reload()}>
            Retry
          </button>
        }
      />
    );
  }

  if (!identity) {
    return (
      <Alert
        message="Authentication Required"
        description="Please log in to access your therapist profile."
        type="warning"
        showIcon
        style={{ margin: '24px' }}
      />
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <EnhancedTherapistProfileForm
        profileId={profileId === 'new' ? undefined : profileId}
        mode={profileId === 'new' ? 'create' : 'edit'}
        onSave={handleProfileSave}
      />
    </div>
  );
};

export default TherapistProfilePage;
