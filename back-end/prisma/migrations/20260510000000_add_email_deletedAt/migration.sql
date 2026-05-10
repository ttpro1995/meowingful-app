-- AddEmailAndDeletedAt

-- Add email column to User table
ALTER TABLE "User" ADD COLUMN "email" TEXT;

-- Create unique index for email
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- Add deletedAt column to User table
ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3);
