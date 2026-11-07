CREATE TABLE IF NOT EXISTS api_rate_limits(subject TEXT NOT NULL,scope TEXT NOT NULL,window INTEGER NOT NULL,calls INTEGER NOT NULL,expires INTEGER NOT NULL,PRIMARY KEY(subject,scope));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_api_rate_limits_expires ON api_rate_limits(expires);
