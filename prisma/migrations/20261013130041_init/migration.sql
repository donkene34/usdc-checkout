-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USDC',
    "depositAddress" TEXT NOT NULL,
    "addressIndex" SERIAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "txHash" TEXT,
    "merchantWebhookUrl" TEXT NOT NULL,
    "webhookSecret" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookLog" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "responseStatus" INTEGER,
    "attempt" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceivedWebhook" (
    "id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "signature" TEXT,
    "valid" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceivedWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatcherState" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "lastScannedBlock" BIGINT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WatcherState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Order_addressIndex_key" ON "Order"("addressIndex");

-- CreateIndex
CREATE INDEX "Order_status_expiresAt_idx" ON "Order"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "WebhookLog_orderId_idx" ON "WebhookLog"("orderId");
