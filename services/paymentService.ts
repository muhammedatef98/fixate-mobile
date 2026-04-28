import { logger } from '../utils/logger';

export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'succeeded' | 'failed';
  orderId: string;
}

/**
 * Create a mock payment intent
 * TODO: Replace with actual Stripe integration
 */
export const createPaymentIntentMock = async (
  orderId: string,
  amount: number
): Promise<PaymentIntent> => {
  try {
    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Return mock payment intent
    return {
      id: `pi_mock_${Date.now()}`,
      amount,
      currency: 'SAR',
      status: 'pending',
      orderId,
    };
  } catch (error) {
    logger.error('Create payment intent error', error);
    throw error;
  }
};

/**
 * Confirm payment (mock)
 * TODO: Replace with actual Stripe payment confirmation
 */
export const confirmPaymentMock = async (
  paymentIntentId: string
): Promise<PaymentIntent> => {
  try {
    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Return successful payment
    return {
      id: paymentIntentId,
      amount: 0,
      currency: 'SAR',
      status: 'succeeded',
      orderId: '',
    };
  } catch (error) {
    logger.error('Confirm payment error', error);
    throw error;
  }
};

/**
 * Get payment status (mock)
 */
export const getPaymentStatus = async (
  paymentIntentId: string
): Promise<'pending' | 'succeeded' | 'failed'> => {
  try {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500));
    return 'succeeded';
  } catch (error) {
    logger.error('Get payment status error', error);
    return 'failed';
  }
};
