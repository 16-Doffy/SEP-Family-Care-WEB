import type { Request, Response, NextFunction } from 'express'
import * as walletService from '../services/wallet.service'
import { z } from 'zod'

export async function getWallets(req: Request, res: Response, next: NextFunction) {
  try {
    const wallets = await walletService.getWallets(req.user.familyId!)
    res.json(wallets)
  } catch (e) {
    next(e)
  }
}

export async function getWallet(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await walletService.getWalletWithTransactions(req.params.id, req.user.familyId!)
    res.json(result)
  } catch (e) {
    next(e)
  }
}

export async function transfer(req: Request, res: Response, next: NextFunction) {
  try {
    const data = z
      .object({
        fromWalletId: z.string(),
        toWalletId: z.string(),
        amount: z.number().positive(),
        description: z.string().optional(),
      })
      .parse(req.body)

    const transaction = await walletService.transfer({
      ...data,
      familyId: req.user.familyId!,
    })
    res.json(transaction)
  } catch (e) {
    next(e)
  }
}

export async function deposit(req: Request, res: Response, next: NextFunction) {
  try {
    const data = z
      .object({
        walletId: z.string(),
        amount: z.number().positive(),
        description: z.string().optional(),
      })
      .parse(req.body)

    const transaction = await walletService.deposit(
      data.walletId,
      data.amount,
      data.description ?? 'Nạp tiền',
      req.user.familyId!,
    )
    res.json(transaction)
  } catch (e) {
    next(e)
  }
}
