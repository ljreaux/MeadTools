-- Support owned sensor-history windows and deterministic timestamp/ID pagination.
CREATE INDEX "logs_brew_id_datetime_id_idx" ON "logs"("brew_id", "datetime", "id");
