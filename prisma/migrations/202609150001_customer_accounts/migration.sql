ALTER TABLE "Customer" ADD COLUMN "userId" UUID;

CREATE UNIQUE INDEX "Customer_userId_key" ON "Customer"("userId");

ALTER TABLE "Customer"
ADD CONSTRAINT "Customer_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
