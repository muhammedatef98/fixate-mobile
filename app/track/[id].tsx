// B-8 / D3: legacy /track/[id] route is a redirect to the real order-details
// screen. The previous implementation rendered a static mock (hard-coded
// "10:30 AM" / "Preparing") with no data fetch and no subscriptions. Anyone
// landing here from a stale deep link is forwarded to the real order screen.

import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function TrackOrderRedirect() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const orderId = Array.isArray(id) ? id[0] : id;

  if (!orderId) {
    return <Redirect href="/(customer)/orders" />;
  }

  return <Redirect href={{ pathname: '/order-details', params: { id: orderId } }} />;
}
