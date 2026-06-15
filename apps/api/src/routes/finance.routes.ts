/**
 * @module finance.routes
 * @description Endpoints REST cho core flow tài chính gia đình.
 *
 * Mount tại `/api/finance`. Mọi route yêu cầu authenticate + requireFamily.
 * Một số route nhạy cảm (sửa chi chung, đóng tháng) chỉ cho PARENT/SUPER_ADMIN.
 */

import { Router, type Router as ExpressRouter } from 'express'
import * as ctrl from '../controllers/finance.controller'
import * as erd from '../controllers/finance-erd.controller'
import { authenticate, requireFamily, requireRole } from '../middleware/auth'

const router: ExpressRouter = Router()
router.use(authenticate, requireFamily)

// ─── ERD finance (internal ledger / jars / budget) ───────────────────────────
// Đọc cho mọi member; cấu hình (model, category, budget) chỉ Manager/Deputy.
router.get('/erd/overview', erd.getOverview)
router.get('/erd/categories', erd.listCategories)
router.post('/erd/categories', requireRole('PARENT', 'SUPER_ADMIN'), erd.createCategory)
router.post('/erd/model', requireRole('PARENT', 'SUPER_ADMIN'), erd.setupModel)
router.get('/erd/entries', erd.listEntries)
router.post('/erd/entries', erd.createEntry)
router.post('/erd/budget-plans', requireRole('PARENT', 'SUPER_ADMIN'), erd.createBudgetPlan)

// Income sources — member tự sửa của mình; PARENT sửa cho mọi người
router.get('/members/:memberId/income-sources', ctrl.listIncomeSources)
router.post('/members/:memberId/income-sources', ctrl.createIncomeSource)
router.patch('/income-sources/:id', ctrl.updateIncomeSource)
router.delete('/income-sources/:id', ctrl.deleteIncomeSource)

// Member budget (nghề nghiệp, chi cá nhân dự kiến, hạn mức)
router.put('/members/:memberId/budget', ctrl.updateMemberBudget)

// Family budget (chi chung dự kiến)
router.get('/budget', ctrl.getBudget)
router.put('/budget', requireRole('PARENT', 'SUPER_ADMIN'), ctrl.upsertBudget)

// Actual income (thu nhập thực tế từng lần ghi nhận)
router.post('/actual-incomes', ctrl.createActualIncome)
router.get('/actual-incomes', ctrl.listActualIncomes)

// Expenses
router.post('/personal-expenses', ctrl.createPersonalExpense)
router.get('/personal-expenses', ctrl.listPersonalExpenses)
router.post('/family-expenses', requireRole('PARENT', 'SUPER_ADMIN'), ctrl.createFamilyExpense)
router.get('/family-expenses', ctrl.listFamilyExpenses)

// Summary / prediction / warnings
router.get('/summary', ctrl.getSummary)
router.get('/prediction', ctrl.getPrediction)
router.get('/warnings', ctrl.getWarnings)

// Đóng tháng — tạo snapshot
router.post('/close-month', requireRole('PARENT', 'SUPER_ADMIN'), ctrl.closeMonth)

export default router
