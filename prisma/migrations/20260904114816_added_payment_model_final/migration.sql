/*
  Warnings:

  - You are about to drop the column `contactNumber` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the column `deletedAt` on the `customers` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "customers" DROP CONSTRAINT "customers_areaId_fkey";

-- DropForeignKey
ALTER TABLE "technicians" DROP CONSTRAINT "technicians_zoneId_fkey";

-- DropIndex
DROP INDEX "customers_contactNumber_key";

-- DropIndex
DROP INDEX "idx_customer_accountNumber";

-- AlterTable
ALTER TABLE "customers" DROP COLUMN "contactNumber",
DROP COLUMN "deletedAt",
ADD COLUMN     "balance" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
ALTER COLUMN "areaId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "power_operators" ALTER COLUMN "substationId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "technicians" ALTER COLUMN "zoneId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "zone_managers" ALTER COLUMN "zoneId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "transactionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payments_transactionId_key" ON "payments"("transactionId");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technicians" ADD CONSTRAINT "technicians_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "distribution_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "idx_customer_isDeleted" RENAME TO "customers_isDeleted_idx";

-- RenameIndex
ALTER INDEX "idx_technician_status" RENAME TO "technicians_status_idx";
