import { Redirect } from 'expo-router';

/**
 * Legacy route. The old screen direct-claimed pending orders ("first
 * technician takes the job") and navigated to a route that no longer exists.
 * The marketplace model replaced direct claiming with offers — the real
 * technician surface is /(technician)/available-orders, so this route now
 * just redirects (kept because old deep links / notifications may target it).
 */
export default function AvailableRequestsRedirect() {
  return <Redirect href={'/(technician)/available-orders' as any} />;
}
