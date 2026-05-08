export const WALLET_TYPE = {
  JOINT: 'JOINT',
  PERSONAL: 'PERSONAL',
} as const

export type WalletType = keyof typeof WALLET_TYPE

export const TRANSACTION_TYPE = {
  DEPOSIT: 'DEPOSIT',
  WITHDRAWAL: 'WITHDRAWAL',
  TRANSFER: 'TRANSFER',
  TASK_REWARD: 'TASK_REWARD',
} as const

export type TransactionType = keyof typeof TRANSACTION_TYPE
