ALTER TABLE "WorkspaceSnapshot" ADD COLUMN "authorId" TEXT;
CREATE TABLE "AccountDeletion" (
 "id" TEXT NOT NULL PRIMARY KEY, "clerkId" TEXT NOT NULL,
 "tokenHash" TEXT NOT NULL, "providerDeleted" BOOLEAN NOT NULL DEFAULT false,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "AccountDeletion_clerkId_key" ON "AccountDeletion"("clerkId");
CREATE TABLE "UploadedAsset" (
 "filename" TEXT NOT NULL PRIMARY KEY, "ownerClerkId" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "UploadedAsset_ownerClerkId_idx" ON "UploadedAsset"("ownerClerkId");
