import React from 'react';
import { Redirect } from 'expo-router';

export default function EntryPoint() {
  // Skip onboarding and go directly to role selection
  return <Redirect href="/role-selection" />;
}
