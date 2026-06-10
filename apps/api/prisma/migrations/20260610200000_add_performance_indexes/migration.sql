-- CreateIndex
CREATE INDEX "User_clinic_id_idx" ON "User"("clinic_id");

-- CreateIndex
CREATE INDEX "Patient_clinic_id_idx" ON "Patient"("clinic_id");

-- CreateIndex
CREATE INDEX "Patient_national_id_idx" ON "Patient"("national_id");

-- CreateIndex
CREATE INDEX "Patient_archived_at_idx" ON "Patient"("archived_at");

-- CreateIndex
CREATE INDEX "Consultation_clinic_id_idx" ON "Consultation"("clinic_id");

-- CreateIndex
CREATE INDEX "Consultation_patient_id_idx" ON "Consultation"("patient_id");

-- CreateIndex
CREATE INDEX "Consultation_specialist_id_idx" ON "Consultation"("specialist_id");

-- CreateIndex
CREATE INDEX "Consultation_consultation_date_idx" ON "Consultation"("consultation_date" DESC);

-- CreateIndex
CREATE INDEX "ConsultationPhoto_consultation_id_idx" ON "ConsultationPhoto"("consultation_id");

-- CreateIndex
CREATE INDEX "AuditLog_clinic_id_idx" ON "AuditLog"("clinic_id");

-- CreateIndex
CREATE INDEX "AuditLog_user_id_idx" ON "AuditLog"("user_id");

-- CreateIndex
CREATE INDEX "RefreshToken_user_id_idx" ON "RefreshToken"("user_id");

-- CreateIndex
CREATE INDEX "PasswordResetToken_user_id_idx" ON "PasswordResetToken"("user_id");

-- CreateIndex
CREATE INDEX "EmailChangeToken_user_id_idx" ON "EmailChangeToken"("user_id");
