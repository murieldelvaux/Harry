-- AlterTable
ALTER TABLE "Expense" ADD COLUMN "installmentGroupId" TEXT,
ADD COLUMN "installmentNumber" INTEGER,
ADD COLUMN "totalInstallments" INTEGER;

-- CreateIndex
CREATE INDEX "Expense_installmentGroupId_idx" ON "Expense"("installmentGroupId");
