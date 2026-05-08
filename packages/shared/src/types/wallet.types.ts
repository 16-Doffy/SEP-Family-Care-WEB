import type { WalletType, TransactionType } from '../constants/walletTypes'

export interface Wallet {
  id: string
  familyId: string
  name: string
  type: WalletType
  balance: number
  currency: string
  ownerId?: string | null
  owner?: { id: string; user: { displayName: string; avatarUrl?: string | null } } | null
  updatedAt: string
}

export interface Transaction {
  id: string
  amount: number
  type: TransactionType
  description?: string | null
  createdAt: string
  fromWallet?: { id: string; name: string } | null
  toWallet?: { id: string; name: string } | null
  task?: { id: string; title: string } | null
}

export interface TransferDto {
  fromWalletId: string
  toWalletId: string
  amount: number
  description?: string
}
