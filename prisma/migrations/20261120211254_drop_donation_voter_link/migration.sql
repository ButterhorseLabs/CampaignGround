/*
  Warnings:

  - You are about to drop the column `voterId` on the `Donation` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Donation" DROP CONSTRAINT "Donation_voterId_fkey";

-- AlterTable
ALTER TABLE "Donation" DROP COLUMN "voterId";
