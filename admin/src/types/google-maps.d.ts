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
  Alert
} from 'antd';
import {
  UserOutlined,
  EnvironmentOutlined,
  ToolOutlined,
  ClockCircleOutlined,
  SaveOutlined,
  HomeOutlined,
  RadiusSettingOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

// Fix the utility import path - check your actual folder structure
import { supabaseClient } from '../utility/supabaseClient';
// OR try: import { supabaseClient } from '../../utility/supabaseClient';
// OR: import { supabaseClient } from '../utility';

// Fix component imports to match actual filenames
import GooglePlacesAddressInput from './googleplacesaddressinput';
import TherapistLocationMap from './therapistlocationmap';

// Add type reference
/// <reference path="../types/google-maps.d.ts" />

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

// ... rest of your component code with these fixes:

// Fix any implicit 'any' types:
// Change: .map(item => ...)
// To: .map((item: any) => ...)

// Example of fixing the line 173 error:
const handleServiceSelection = (services: any[]) => {
  setSelectedServices(services.map((item: any) => item.value));
};
