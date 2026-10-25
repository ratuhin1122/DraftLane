ALTER TABLE "Workspace" ADD COLUMN "generation" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Canvas" ADD COLUMN "yjsState" BYTEA;
CREATE TABLE "WorkspaceMember" (
 "id" TEXT NOT NULL PRIMARY KEY, "workspaceId" TEXT NOT NULL, "userId" TEXT NOT NULL,
 "role" TEXT NOT NULL DEFAULT 'VIEWER' CHECK ("role" IN ('VIEWER','COMMENTER','EDITOR')),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "WorkspaceMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "WorkspaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "WorkspaceMember_workspaceId_userId_key" ON "WorkspaceMember"("workspaceId","userId");
CREATE INDEX "WorkspaceMember_userId_idx" ON "WorkspaceMember"("userId");
CREATE TABLE "WorkspaceComment" (
 "id" TEXT NOT NULL PRIMARY KEY, "workspaceId" TEXT NOT NULL, "authorId" TEXT NOT NULL, "authorName" TEXT NOT NULL,
 "body" TEXT NOT NULL, "surface" TEXT NOT NULL DEFAULT 'WORKSPACE', "anchorId" TEXT,
 "resolvedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "WorkspaceComment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "WorkspaceComment_workspaceId_createdAt_idx" ON "WorkspaceComment"("workspaceId","createdAt");
CREATE TABLE "WorkspaceSnapshot" (
 "id" TEXT NOT NULL PRIMARY KEY, "workspaceId" TEXT NOT NULL, "label" TEXT NOT NULL, "authorName" TEXT NOT NULL,
 "generation" INTEGER NOT NULL, "docContent" JSONB, "docState" BYTEA, "canvasContent" JSONB, "canvasState" BYTEA, "tasks" JSONB,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "WorkspaceSnapshot_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "WorkspaceSnapshot_workspaceId_createdAt_idx" ON "WorkspaceSnapshot"("workspaceId","createdAt");
CREATE TABLE "WorkspaceTask" (
 "id" TEXT NOT NULL PRIMARY KEY, "workspaceId" TEXT NOT NULL, "title" TEXT NOT NULL, "description" TEXT NOT NULL DEFAULT '',
 "phase" TEXT NOT NULL DEFAULT 'Implementation', "status" TEXT NOT NULL DEFAULT 'TODO' CHECK ("status" IN ('TODO','IN_PROGRESS','DONE')),
 "sourceKey" TEXT, "position" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "WorkspaceTask_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "WorkspaceTask_workspaceId_sourceKey_key" ON "WorkspaceTask"("workspaceId","sourceKey");
CREATE INDEX "WorkspaceTask_workspaceId_position_idx" ON "WorkspaceTask"("workspaceId","position");
