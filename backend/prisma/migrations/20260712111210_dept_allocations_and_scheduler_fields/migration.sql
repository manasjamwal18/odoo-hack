-- DropForeignKey
ALTER TABLE "Allocation" DROP CONSTRAINT "Allocation_userId_fkey";

-- AlterTable
ALTER TABLE "Allocation" ADD COLUMN     "departmentId" TEXT,
ADD COLUMN     "overdueNotifiedAt" TIMESTAMP(3),
ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "reminderSent" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
