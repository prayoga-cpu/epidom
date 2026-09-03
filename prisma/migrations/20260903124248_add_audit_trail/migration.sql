-- CreateEnum
CREATE TYPE "AuditActorKind" AS ENUM ('USER', 'STAFF', 'PUBLIC', 'SYSTEM', 'WEBHOOK');

-- CreateEnum
CREATE TYPE "AuditGrantSource" AS ENUM ('DB_FLAG', 'HARDCODED_EMAIL');

-- CreateEnum
CREATE TYPE "ActivityOutcome" AS ENUM ('SUCCESS', 'DENIED', 'FAILED');

-- CreateEnum
CREATE TYPE "AuditSeverity" AS ENUM ('INFO', 'NOTICE', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ActionReversibility" AS ENUM ('REVERSIBLE', 'REVERSIBLE_WITH_CAVEAT', 'COMPENSATE_ONLY', 'SNAPSHOT_RESTORE', 'IRREVERSIBLE');

-- CreateEnum
CREATE TYPE "ActionLogState" AS ENUM ('PENDING', 'RECORDED', 'REVERTED', 'SUPERSEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "SnapshotStatus" AS ENUM ('CAPTURING', 'STORED', 'EXPIRED', 'SHREDDED', 'FAILED');

-- CreateEnum
CREATE TYPE "RestoreRunStatus" AS ENUM ('PLANNED', 'RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED', 'REFUSED');

-- CreateTable
CREATE TABLE "activity_events" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorKind" "AuditActorKind" NOT NULL,
    "actorRefId" TEXT,
    "actorName" TEXT,
    "actorEmail" TEXT,
    "actorGrant" "AuditGrantSource",
    "storeId" TEXT,
    "businessId" TEXT,
    "actionCode" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "statusCode" INTEGER,
    "outcome" "ActivityOutcome" NOT NULL DEFAULT 'SUCCESS',
    "severity" "AuditSeverity" NOT NULL DEFAULT 'INFO',
    "targetType" TEXT,
    "targetId" TEXT,
    "durationMs" INTEGER,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "actionLogId" TEXT,

    CONSTRAINT "activity_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_logs" (
    "id" TEXT NOT NULL,
    "requestId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actionType" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "state" "ActionLogState" NOT NULL DEFAULT 'PENDING',
    "reversibility" "ActionReversibility" NOT NULL,
    "severity" "AuditSeverity" NOT NULL DEFAULT 'NOTICE',
    "actorKind" "AuditActorKind" NOT NULL,
    "actorRefId" TEXT,
    "actorName" TEXT,
    "actorEmail" TEXT,
    "actorGrant" "AuditGrantSource",
    "actorHash" TEXT,
    "storeId" TEXT,
    "businessId" TEXT,
    "targetType" TEXT,
    "targetId" TEXT,
    "targetLabel" TEXT,
    "subjectUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "payload" JSONB,
    "reason" TEXT,
    "reversesActionId" TEXT,
    "correctsActionId" TEXT,
    "snapshotId" TEXT,
    "supersededAt" TIMESTAMP(3),
    "flaggedAt" TIMESTAMP(3),
    "flaggedNote" TEXT,
    "lockedAt" TIMESTAMP(3),
    "scrubbedAt" TIMESTAMP(3),
    "errorMessage" TEXT,

    CONSTRAINT "action_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_annotations" (
    "id" TEXT NOT NULL,
    "actionLogId" TEXT NOT NULL,
    "authorKind" "AuditActorKind" NOT NULL,
    "authorRefId" TEXT,
    "authorName" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "action_annotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_snapshots" (
    "id" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "SnapshotStatus" NOT NULL DEFAULT 'CAPTURING',
    "rootType" TEXT NOT NULL,
    "rootId" TEXT NOT NULL,
    "rootLabel" TEXT,
    "reasonCode" TEXT NOT NULL,
    "storeId" TEXT,
    "businessId" TEXT,
    "subjectUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "payload" JSONB,
    "payloadUrl" TEXT,
    "payloadSha256" TEXT,
    "payloadBytes" INTEGER NOT NULL DEFAULT 0,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "modelCount" INTEGER NOT NULL DEFAULT 0,
    "orphanRepairs" JSONB,
    "schemaVersion" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lockedAt" TIMESTAMP(3),
    "scrubbedAt" TIMESTAMP(3),
    "errorMessage" TEXT,

    CONSTRAINT "entity_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restore_runs" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "status" "RestoreRunStatus" NOT NULL DEFAULT 'PLANNED',
    "dryRun" BOOLEAN NOT NULL DEFAULT true,
    "plannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "actorRefId" TEXT,
    "actorName" TEXT,
    "reason" TEXT,
    "plan" JSONB,
    "rowsRestored" INTEGER NOT NULL DEFAULT 0,
    "modelsDone" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "quarantined" BOOLEAN NOT NULL DEFAULT false,
    "errorMessage" TEXT,

    CONSTRAINT "restore_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "activity_events_actionLogId_key" ON "activity_events"("actionLogId");

-- CreateIndex
CREATE INDEX "activity_events_occurredAt_idx" ON "activity_events"("occurredAt");

-- CreateIndex
CREATE INDEX "activity_events_actorKind_actorRefId_occurredAt_idx" ON "activity_events"("actorKind", "actorRefId", "occurredAt");

-- CreateIndex
CREATE INDEX "activity_events_storeId_occurredAt_idx" ON "activity_events"("storeId", "occurredAt");

-- CreateIndex
CREATE INDEX "activity_events_actionCode_occurredAt_idx" ON "activity_events"("actionCode", "occurredAt");

-- CreateIndex
CREATE INDEX "activity_events_targetType_targetId_idx" ON "activity_events"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "activity_events_outcome_severity_occurredAt_idx" ON "activity_events"("outcome", "severity", "occurredAt");

-- CreateIndex
CREATE INDEX "activity_events_requestId_idx" ON "activity_events"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "action_logs_reversesActionId_key" ON "action_logs"("reversesActionId");

-- CreateIndex
CREATE UNIQUE INDEX "action_logs_snapshotId_key" ON "action_logs"("snapshotId");

-- CreateIndex
CREATE INDEX "action_logs_occurredAt_idx" ON "action_logs"("occurredAt");

-- CreateIndex
CREATE INDEX "action_logs_actionType_occurredAt_idx" ON "action_logs"("actionType", "occurredAt");

-- CreateIndex
CREATE INDEX "action_logs_actorKind_actorRefId_occurredAt_idx" ON "action_logs"("actorKind", "actorRefId", "occurredAt");

-- CreateIndex
CREATE INDEX "action_logs_storeId_occurredAt_idx" ON "action_logs"("storeId", "occurredAt");

-- CreateIndex
CREATE INDEX "action_logs_targetType_targetId_occurredAt_idx" ON "action_logs"("targetType", "targetId", "occurredAt");

-- CreateIndex
CREATE INDEX "action_logs_state_severity_occurredAt_idx" ON "action_logs"("state", "severity", "occurredAt");

-- CreateIndex
CREATE INDEX "action_logs_subjectUserIds_idx" ON "action_logs" USING GIN ("subjectUserIds");

-- CreateIndex
CREATE INDEX "action_annotations_actionLogId_createdAt_idx" ON "action_annotations"("actionLogId", "createdAt");

-- CreateIndex
CREATE INDEX "entity_snapshots_capturedAt_idx" ON "entity_snapshots"("capturedAt");

-- CreateIndex
CREATE INDEX "entity_snapshots_rootType_rootId_idx" ON "entity_snapshots"("rootType", "rootId");

-- CreateIndex
CREATE INDEX "entity_snapshots_status_expiresAt_idx" ON "entity_snapshots"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "entity_snapshots_subjectUserIds_idx" ON "entity_snapshots" USING GIN ("subjectUserIds");

-- CreateIndex
CREATE INDEX "restore_runs_snapshotId_plannedAt_idx" ON "restore_runs"("snapshotId", "plannedAt");

-- CreateIndex
CREATE INDEX "restore_runs_status_plannedAt_idx" ON "restore_runs"("status", "plannedAt");

-- AddForeignKey
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_actionLogId_fkey" FOREIGN KEY ("actionLogId") REFERENCES "action_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_logs" ADD CONSTRAINT "action_logs_reversesActionId_fkey" FOREIGN KEY ("reversesActionId") REFERENCES "action_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_logs" ADD CONSTRAINT "action_logs_correctsActionId_fkey" FOREIGN KEY ("correctsActionId") REFERENCES "action_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_logs" ADD CONSTRAINT "action_logs_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "entity_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_annotations" ADD CONSTRAINT "action_annotations_actionLogId_fkey" FOREIGN KEY ("actionLogId") REFERENCES "action_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restore_runs" ADD CONSTRAINT "restore_runs_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "entity_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
