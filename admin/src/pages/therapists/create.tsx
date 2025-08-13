// admin/src/pages/therapists/create.tsx
import React from 'react';
import { EnhancedTherapistProfileForm } from '../../components';

const CreateTherapistPage: React.FC = () => {
  return (
    <EnhancedTherapistProfileForm
      mode="create"
      onSave={(profile) => {
        // Handle creation success
      }}
    />
  );
};

export default CreateTherapistPage;
