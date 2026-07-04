import React from 'react';
import ProviderAuthScreen from '../components/ProviderAuthScreen';

/**
 * Courier entry to the provider portal. Courier is a first-class role with
 * its own route segment — the root-layout auth guard maps 'courier-auth' to
 * the /(courier) portal after login (see COURIER_AUTH_SOURCES in _layout).
 */
export default function CourierAuthScreen() {
  return <ProviderAuthScreen flow="courier" />;
}
