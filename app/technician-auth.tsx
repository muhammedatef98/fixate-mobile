import React from 'react';
import ProviderAuthScreen from '../components/ProviderAuthScreen';

/**
 * Technician entry to the provider portal. The form itself lives in
 * components/ProviderAuthScreen (shared with /courier-auth); this route
 * segment is what the root-layout auth guard keys on to decide the
 * post-login portal, so it must stay a distinct file.
 */
export default function TechnicianAuthScreen() {
  return <ProviderAuthScreen flow="technician" />;
}
