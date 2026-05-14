/**
 * @module wallet.controller
 * @description Controller xử lý các HTTP request liên quan đến ví tiền.
 * Mỗi handler chịu trách nhiệm:
 *  1. Validate dữ liệu đầu vào (dùng Zod schema).
 *  2. Gọi tầng service để thực thi nghiệp vụ.
 *  3. Trả về response JSON hoặc chuyển lỗi sang middleware xử lý lỗi toàn cục.
 *
 * Thông tin gia đình (familyId) được lấy từ `req.user` — được gắn vào request
 * bởi middleware `authenticate` + `requireFamily`.
 */

import type { Request, Response, NextFunction } from 'express'
import * as walletService from '../services/wallet.service'
import { z } from 'zod'

/**
 * Lấy danh sách tất cả ví của gia đình hiện tại.
 * Kết quả bao gồm thông tin chủ sở hữu của từng ví.
 *
 * @route GET /wallets
 * @param req - Express Request. `req.user.familyId` xác định gia đình.
 * @param res - Express Response. Trả về mảng JSON các ví.
 * @param next - Express NextFunction để chuyển lỗi sang error handler.
 */
export async function getWallets(req: Request, res: Response, next: NextFunction) {
  try {
    const wallets = await walletService.getWallets(req.user.familyId!)
    res.json(wallets)
  } catch (e) {
    next(e)
  }
}

/**
 * Lấy thông tin chi tiết của một ví kèm 50 giao dịch gần nhất.
 *
 * @route GET /wallets/:id
 * @param req - Express Request. `req.params.id` là ID ví; `req.user.familyId` là gia đình.
 * @param res - Express Response. Trả về JSON `{ wallet, transactions }`.
 * @param next - Express NextFunction để chuyển lỗi sang error handler.
 */
export async function getWallet(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await walletService.getWalletWithTransactions(req.params.id, req.user.familyId!)
    res.json(result)
  } catch (e) {
    next(e)
  }
}

/**
 * Chuyển tiền giữa hai ví trong cùng gia đình.
 * Chỉ PARENT hoặc SUPER_ADMIN mới được phép thực hiện.
 *
 * Request body được validate bằng Zod trước khi truyền xuống service.
 * `familyId` được lấy tự động từ token xác thực để đảm bảo không thể
 * chuyển tiền sang ví của gia đình khác.
 *
 * @route POST /wallets/transfer
 * @param req - Express Request. Body: `{ fromWalletId, toWalletId, amount, description? }`.
 * @param res - Express Response. Trả về bản ghi giao dịch vừa tạo.
 * @param next - Express NextFunction để chuyển lỗi sang error handler.
 */
export async function transfer(req: Request, res: Response, next: NextFunction) {
  try {
    // Validate dữ liệu đầu vào: amount phải là số dương
    const data = z
      .object({
        fromWalletId: z.string(),
        toWalletId: z.string(),
        amount: z.number().positive(),
        description: z.string().optional(),
      })
      .parse(req.body)

    // Ghép familyId từ token vào để service kiểm tra quyền sở hữu ví
    const transaction = await walletService.transfer({
      ...data,
      familyId: req.user.familyId!,
    })
    res.json(transaction)
  } catch (e) {
    next(e)
  }
}

/**
 * Nạp tiền (deposit) vào một ví thuộc gia đình hiện tại.
 * Chỉ PARENT hoặc SUPER_ADMIN mới được phép thực hiện.
 *
 * Nếu người dùng không truyền `description`, mặc định sẽ là 'Nạp tiền'.
 *
 * @route POST /wallets/deposit
 * @param req - Express Request. Body: `{ walletId, amount, description? }`.
 * @param res - Express Response. Trả về bản ghi giao dịch DEPOSIT vừa tạo.
 * @param next - Express NextFunction để chuyển lỗi sang error handler.
 */
export async function deposit(req: Request, res: Response, next: NextFunction) {
  try {
    // Validate dữ liệu đầu vào: amount phải là số dương
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
      // Dùng giá trị mặc định 'Nạp tiền' nếu không có mô tả
      data.description ?? 'Nạp tiền',
      req.user.familyId!,
    )
    res.json(transaction)
  } catch (e) {
    next(e)
  }
}
