CREATE TABLE `catalog_search_jobs` (
	`cache_key` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`car_id` text NOT NULL,
	`vin` text NOT NULL,
	`lease` text NOT NULL,
	`lease_until` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_catalog_jobs_owner_car` ON `catalog_search_jobs` (`owner`,`car_id`);--> statement-breakpoint
CREATE INDEX `idx_catalog_jobs_lease` ON `catalog_search_jobs` (`lease_until`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `vin_decode_cache_world_v4` (
	`vin` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_vin_cache_expires` ON `vin_decode_cache_world_v4` (`expires_at`);
--> statement-breakpoint
CREATE TRIGGER catalog_cache_parent_insert BEFORE INSERT ON catalog_offer_cache WHEN NOT EXISTS(SELECT 1 FROM records WHERE id=NEW.car_id AND owner=NEW.owner AND kind='car' AND json_extract(payload,'$.vin')=NEW.vin) OR EXISTS(SELECT 1 FROM user_data_erasure WHERE owner=NEW.owner) BEGIN SELECT RAISE(ABORT,'MOTORNA_PARENT_MISSING'); END;
--> statement-breakpoint
CREATE TRIGGER catalog_cache_parent_update BEFORE UPDATE ON catalog_offer_cache WHEN NOT EXISTS(SELECT 1 FROM records WHERE id=NEW.car_id AND owner=NEW.owner AND kind='car' AND json_extract(payload,'$.vin')=NEW.vin) OR EXISTS(SELECT 1 FROM user_data_erasure WHERE owner=NEW.owner) BEGIN SELECT RAISE(ABORT,'MOTORNA_PARENT_MISSING'); END;
--> statement-breakpoint
CREATE TRIGGER catalog_job_parent_insert BEFORE INSERT ON catalog_search_jobs WHEN NOT EXISTS(SELECT 1 FROM records WHERE id=NEW.car_id AND owner=NEW.owner AND kind='car' AND json_extract(payload,'$.vin')=NEW.vin) OR EXISTS(SELECT 1 FROM user_data_erasure WHERE owner=NEW.owner) BEGIN SELECT RAISE(ABORT,'MOTORNA_PARENT_MISSING'); END;
--> statement-breakpoint
CREATE TRIGGER catalog_job_parent_update BEFORE UPDATE ON catalog_search_jobs WHEN NOT EXISTS(SELECT 1 FROM records WHERE id=NEW.car_id AND owner=NEW.owner AND kind='car' AND json_extract(payload,'$.vin')=NEW.vin) OR EXISTS(SELECT 1 FROM user_data_erasure WHERE owner=NEW.owner) BEGIN SELECT RAISE(ABORT,'MOTORNA_PARENT_MISSING'); END;
--> statement-breakpoint
CREATE TRIGGER cleanup_catalog_car_delete AFTER DELETE ON records WHEN OLD.kind='car' BEGIN DELETE FROM catalog_offer_cache WHERE owner=OLD.owner AND car_id=OLD.id; DELETE FROM catalog_search_jobs WHERE owner=OLD.owner AND car_id=OLD.id; END;
--> statement-breakpoint
CREATE TRIGGER cleanup_catalog_car_change AFTER UPDATE ON records WHEN OLD.kind='car' BEGIN DELETE FROM catalog_offer_cache WHERE owner=OLD.owner AND car_id=OLD.id; DELETE FROM catalog_search_jobs WHERE owner=OLD.owner AND car_id=OLD.id; END;
--> statement-breakpoint
CREATE TRIGGER cleanup_catalog_owner AFTER INSERT ON user_data_erasure BEGIN DELETE FROM catalog_offer_cache WHERE owner=NEW.owner; DELETE FROM catalog_search_jobs WHERE owner=NEW.owner; END;
