CREATE TABLE IF NOT EXISTS car_documents(document_id TEXT PRIMARY KEY,car_id TEXT NOT NULL,owner TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS car_shares(token TEXT PRIMARY KEY,owner TEXT NOT NULL,car_id TEXT NOT NULL,payload TEXT NOT NULL,document_ids TEXT NOT NULL,created INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS car_shares_owner ON car_shares(owner,car_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_car_documents_owner_car ON car_documents(owner,car_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS station_reviews(station TEXT NOT NULL,owner TEXT NOT NULL,author TEXT NOT NULL,rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),text TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(station,owner));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_station_reviews_station_updated ON station_reviews(station,updated_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_station_reviews_owner ON station_reviews(owner);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS user_data_erasure(owner TEXT PRIMARY KEY NOT NULL,state TEXT NOT NULL DEFAULT 'pending',created INTEGER NOT NULL,updated INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS user_data_erasure_blobs(owner TEXT NOT NULL,object_key TEXT NOT NULL,PRIMARY KEY(owner,object_key));

--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS erase_guard_records_insert BEFORE INSERT ON records WHEN EXISTS(SELECT 1 FROM user_data_erasure WHERE owner=NEW.owner) BEGIN SELECT RAISE(ABORT,'MOTORNA_OWNER_ERASED'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS erase_guard_records_update BEFORE UPDATE ON records WHEN EXISTS(SELECT 1 FROM user_data_erasure WHERE owner=NEW.owner) BEGIN SELECT RAISE(ABORT,'MOTORNA_OWNER_ERASED'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS erase_guard_documents_insert BEFORE INSERT ON documents WHEN EXISTS(SELECT 1 FROM user_data_erasure WHERE owner=NEW.owner) BEGIN SELECT RAISE(ABORT,'MOTORNA_OWNER_ERASED'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS erase_guard_documents_update BEFORE UPDATE ON documents WHEN EXISTS(SELECT 1 FROM user_data_erasure WHERE owner=NEW.owner) BEGIN SELECT RAISE(ABORT,'MOTORNA_OWNER_ERASED'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS erase_guard_car_documents_insert BEFORE INSERT ON car_documents WHEN EXISTS(SELECT 1 FROM user_data_erasure WHERE owner=NEW.owner) BEGIN SELECT RAISE(ABORT,'MOTORNA_OWNER_ERASED'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS erase_guard_car_documents_update BEFORE UPDATE ON car_documents WHEN EXISTS(SELECT 1 FROM user_data_erasure WHERE owner=NEW.owner) BEGIN SELECT RAISE(ABORT,'MOTORNA_OWNER_ERASED'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS erase_guard_car_shares_insert BEFORE INSERT ON car_shares WHEN EXISTS(SELECT 1 FROM user_data_erasure WHERE owner=NEW.owner) BEGIN SELECT RAISE(ABORT,'MOTORNA_OWNER_ERASED'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS erase_guard_car_shares_update BEFORE UPDATE ON car_shares WHEN EXISTS(SELECT 1 FROM user_data_erasure WHERE owner=NEW.owner) BEGIN SELECT RAISE(ABORT,'MOTORNA_OWNER_ERASED'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS erase_guard_vehicle_photos_insert BEFORE INSERT ON vehicle_photos WHEN EXISTS(SELECT 1 FROM user_data_erasure WHERE owner=NEW.owner) BEGIN SELECT RAISE(ABORT,'MOTORNA_OWNER_ERASED'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS erase_guard_vehicle_photos_update BEFORE UPDATE ON vehicle_photos WHEN EXISTS(SELECT 1 FROM user_data_erasure WHERE owner=NEW.owner) BEGIN SELECT RAISE(ABORT,'MOTORNA_OWNER_ERASED'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS erase_guard_vehicle_photo_search_insert BEFORE INSERT ON vehicle_photo_search WHEN EXISTS(SELECT 1 FROM user_data_erasure WHERE owner=NEW.owner) BEGIN SELECT RAISE(ABORT,'MOTORNA_OWNER_ERASED'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS erase_guard_vehicle_photo_search_update BEFORE UPDATE ON vehicle_photo_search WHEN EXISTS(SELECT 1 FROM user_data_erasure WHERE owner=NEW.owner) BEGIN SELECT RAISE(ABORT,'MOTORNA_OWNER_ERASED'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS erase_guard_station_reviews_insert BEFORE INSERT ON station_reviews WHEN EXISTS(SELECT 1 FROM user_data_erasure WHERE owner=NEW.owner) BEGIN SELECT RAISE(ABORT,'MOTORNA_OWNER_ERASED'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS erase_guard_station_reviews_update BEFORE UPDATE ON station_reviews WHEN EXISTS(SELECT 1 FROM user_data_erasure WHERE owner=NEW.owner) BEGIN SELECT RAISE(ABORT,'MOTORNA_OWNER_ERASED'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS car_document_parent_insert BEFORE INSERT ON car_documents WHEN NOT EXISTS(SELECT 1 FROM records r JOIN documents d ON d.id=NEW.document_id AND d.owner=r.owner WHERE r.id=NEW.car_id AND r.owner=NEW.owner AND r.kind='car') BEGIN SELECT RAISE(ABORT,'MOTORNA_PARENT_MISSING'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS car_document_parent_update BEFORE UPDATE ON car_documents WHEN NOT EXISTS(SELECT 1 FROM records r JOIN documents d ON d.id=NEW.document_id AND d.owner=r.owner WHERE r.id=NEW.car_id AND r.owner=NEW.owner AND r.kind='car') BEGIN SELECT RAISE(ABORT,'MOTORNA_PARENT_MISSING'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS restrict_car_documents BEFORE DELETE ON records WHEN OLD.kind='car' AND EXISTS(SELECT 1 FROM car_documents c JOIN documents d ON d.id=c.document_id AND d.owner=c.owner WHERE c.car_id=OLD.id AND c.owner=OLD.owner) BEGIN SELECT RAISE(ABORT,'MOTORNA_CAR_HAS_DOCUMENTS'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS cleanup_car_shares AFTER DELETE ON records WHEN OLD.kind='car' BEGIN DELETE FROM car_shares WHERE car_id=OLD.id AND owner=OLD.owner; DELETE FROM car_documents WHERE car_id=OLD.id AND owner=OLD.owner; END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS cleanup_document_links AFTER DELETE ON documents BEGIN DELETE FROM car_shares WHERE owner=OLD.owner AND EXISTS(SELECT 1 FROM json_each(document_ids) WHERE value=OLD.id); DELETE FROM car_documents WHERE document_id=OLD.id AND owner=OLD.owner; END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS share_parent_insert BEFORE INSERT ON car_shares WHEN NOT EXISTS(SELECT 1 FROM records WHERE id=NEW.car_id AND owner=NEW.owner AND kind='car') OR EXISTS(SELECT 1 FROM json_each(NEW.document_ids) j WHERE NOT EXISTS(SELECT 1 FROM car_documents c JOIN documents d ON d.id=c.document_id AND d.owner=c.owner WHERE c.document_id=j.value AND c.car_id=NEW.car_id AND c.owner=NEW.owner)) BEGIN SELECT RAISE(ABORT,'MOTORNA_PARENT_MISSING'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS share_parent_update BEFORE UPDATE ON car_shares WHEN NOT EXISTS(SELECT 1 FROM records WHERE id=NEW.car_id AND owner=NEW.owner AND kind='car') OR EXISTS(SELECT 1 FROM json_each(NEW.document_ids) j WHERE NOT EXISTS(SELECT 1 FROM car_documents c JOIN documents d ON d.id=c.document_id AND d.owner=c.owner WHERE c.document_id=j.value AND c.car_id=NEW.car_id AND c.owner=NEW.owner)) BEGIN SELECT RAISE(ABORT,'MOTORNA_PARENT_MISSING'); END;
