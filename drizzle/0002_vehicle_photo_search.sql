CREATE TABLE IF NOT EXISTS vehicle_photo_search (
 owner TEXT NOT NULL, car_id TEXT NOT NULL, vin TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'idle', lease TEXT, lease_until INTEGER NOT NULL DEFAULT 0,
 checked INTEGER NOT NULL DEFAULT 0, retry_at INTEGER NOT NULL DEFAULT 0,
 providers TEXT NOT NULL DEFAULT '[]', primary_id TEXT, hide_external INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(owner,car_id)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS vehicle_photos (
 id TEXT PRIMARY KEY NOT NULL, owner TEXT NOT NULL, car_id TEXT NOT NULL,
 vin TEXT NOT NULL, dedupe_key TEXT NOT NULL, payload TEXT NOT NULL,
 object_key TEXT, expires INTEGER NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicle_photo_dedupe ON vehicle_photos(owner,car_id,dedupe_key);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_vehicle_photo_car ON vehicle_photos(owner,car_id,vin,expires);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS vehicle_photo_budget (
 scope TEXT NOT NULL, day TEXT NOT NULL, calls INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(scope,day)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_records_owner_vin ON records(owner,kind,json_extract(payload,'$.vin'));
--> statement-breakpoint
-- Trigger cleanup is atomic with parent deletion; late provider writes also
-- require the current parent VIN and the current job lease. Keep R2 keys in a
-- retryable outbox because SQL cannot delete objects from R2.
CREATE TABLE IF NOT EXISTS vehicle_photo_gc (object_key TEXT PRIMARY KEY NOT NULL, not_before INTEGER NOT NULL DEFAULT 0);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS vehicle_photo_delete AFTER DELETE ON records WHEN OLD.kind='car'
BEGIN
 INSERT OR IGNORE INTO vehicle_photo_gc(object_key) SELECT object_key FROM vehicle_photos WHERE owner=OLD.owner AND car_id=OLD.id AND object_key IS NOT NULL;
 DELETE FROM vehicle_photos WHERE owner=OLD.owner AND car_id=OLD.id;
 DELETE FROM vehicle_photo_search WHERE owner=OLD.owner AND car_id=OLD.id;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS vehicle_photo_vin_change AFTER UPDATE OF payload ON records WHEN OLD.kind='car' AND COALESCE(json_extract(OLD.payload,'$.vin'),'')<>COALESCE(json_extract(NEW.payload,'$.vin'),'')
BEGIN
 INSERT OR IGNORE INTO vehicle_photo_gc(object_key) SELECT object_key FROM vehicle_photos WHERE owner=OLD.owner AND car_id=OLD.id AND object_key IS NOT NULL;
 DELETE FROM vehicle_photos WHERE owner=OLD.owner AND car_id=OLD.id;
 DELETE FROM vehicle_photo_search WHERE owner=OLD.owner AND car_id=OLD.id;
END;
