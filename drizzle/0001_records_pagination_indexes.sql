CREATE INDEX `idx_records_owner_created_id` ON `records` (`owner`,`created`,`id`);--> statement-breakpoint
CREATE INDEX `idx_records_owner_kind_created_id` ON `records` (`owner`,`kind`,`created`,`id`);--> statement-breakpoint
CREATE INDEX `idx_records_owner_car_created_id` ON `records` (`owner`,json_extract(payload, '$.carId'),`created`,`id`);--> statement-breakpoint
CREATE INDEX `idx_records_owner_kind_car_created_id` ON `records` (`owner`,`kind`,json_extract(payload, '$.carId'),`created`,`id`);