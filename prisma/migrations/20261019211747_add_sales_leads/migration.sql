-- CreateTable
CREATE TABLE "sales_leads" (
    "id" TEXT NOT NULL,
    "page" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'fr',
    "source" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sales_leads_page_createdAt_idx" ON "sales_leads"("page", "createdAt");

-- CreateIndex
CREATE INDEX "sales_leads_email_idx" ON "sales_leads"("email");
