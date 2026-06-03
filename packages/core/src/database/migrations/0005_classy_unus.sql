CREATE TABLE "activity_code_member" (
	"activity_code_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activity_code_member_activity_code_id_user_id_pk" PRIMARY KEY("activity_code_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "activity_code_member" ADD CONSTRAINT "activity_code_member_activity_code_id_activity_codes_id_fk" FOREIGN KEY ("activity_code_id") REFERENCES "public"."activity_codes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_code_member" ADD CONSTRAINT "activity_code_member_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO "activity_code_member" ("activity_code_id", "user_id")
SELECT "id", "user_id" FROM "activity_codes"
ON CONFLICT DO NOTHING;
--> statement-breakpoint
ALTER TABLE "activity_codes" DROP CONSTRAINT "activity_codes_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "activity_codes" RENAME COLUMN "user_id" TO "created_by";--> statement-breakpoint
ALTER TABLE "activity_codes" ALTER COLUMN "created_by" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "activity_codes" ADD CONSTRAINT "activity_codes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
