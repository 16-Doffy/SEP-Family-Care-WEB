import { api } from '@/lib/api'

interface CheckoutResponse {
  mode: 'mock' | 'stripe'
  paymentId: string
  checkoutUrl: string | null
}

type CheckoutInput =
  | { type: 'SUBSCRIPTION'; planId: string }
  | { type: 'WALLET_TOPUP'; amount: number; walletId: string; description?: string }

/**
 * One-call helper: creates a payment then immediately confirms it in mock mode,
 * or redirects to Stripe Checkout when the backend returns a checkoutUrl.
 * Returns true if the payment succeeded synchronously.
 */
export async function startCheckout(input: CheckoutInput): Promise<boolean> {
  const { data } = await api.post<CheckoutResponse>('/payments/checkout', input)

  if (data.mode === 'mock') {
    await api.post(`/payments/${data.paymentId}/confirm-mock`)
    return true
  }

  if (data.checkoutUrl) {
    window.location.href = data.checkoutUrl
    return false
  }

  throw new Error('Unsupported payment mode')
}
