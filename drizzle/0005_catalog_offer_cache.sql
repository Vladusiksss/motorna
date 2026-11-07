CREATE TABLE `catalog_offer_cache` (
	`cache_key` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`car_id` text NOT NULL,
	`vin` text NOT NULL,
	`payload` text NOT NULL,
	`fresh_until` integer NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_catalog_cache_owner_car` ON `catalog_offer_cache` (`owner`,`car_id`);--> statement-breakpoint
CREATE INDEX `idx_catalog_cache_expires` ON `catalog_offer_cache` (`expires`);