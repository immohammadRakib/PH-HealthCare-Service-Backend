/*
  Warnings:

  - A unique constraint covering the columns `[contactNumber]` on the table `customers` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "contactNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "customers_contactNumber_key" ON "customers"("contactNumber");
