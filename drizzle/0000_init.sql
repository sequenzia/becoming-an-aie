CREATE TYPE "public"."module_status" AS ENUM('not_started', 'in_progress', 'completed');--> statement-breakpoint
CREATE TYPE "public"."response_kind" AS ENUM('workshop', 'failure');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "feedback_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "module_progress" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "module_progress_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"module_slug" text NOT NULL,
	"status" "module_status" DEFAULT 'not_started' NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "notify_subscriber" (
	"email" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	"unsubscribed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "self_assessment" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "self_assessment_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"version" integer NOT NULL,
	"ratings" jsonb NOT NULL,
	"context" jsonb NOT NULL,
	"plan" jsonb NOT NULL,
	"plan_text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "self_check_result" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "self_check_result_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"module_slug" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"passed" boolean DEFAULT false NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workshop_response" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "workshop_response_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"module_slug" text NOT NULL,
	"kind" "response_kind" DEFAULT 'workshop' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_progress" ADD CONSTRAINT "module_progress_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "self_assessment" ADD CONSTRAINT "self_assessment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "self_check_result" ADD CONSTRAINT "self_check_result_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshop_response" ADD CONSTRAINT "workshop_response_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "module_progress_user_module_uidx" ON "module_progress" USING btree ("user_id","module_slug");--> statement-breakpoint
CREATE UNIQUE INDEX "self_assessment_user_version_uidx" ON "self_assessment" USING btree ("user_id","version");--> statement-breakpoint
CREATE INDEX "self_assessment_user_idx" ON "self_assessment" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "self_check_result_user_module_uidx" ON "self_check_result" USING btree ("user_id","module_slug");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "workshop_response_user_module_kind_uidx" ON "workshop_response" USING btree ("user_id","module_slug","kind");