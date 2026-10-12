-- CreateEnum
CREATE TYPE "nav_audience_module" AS ENUM ('ALL', 'AUTH_ONLY', 'ADMIN_ONLY');

-- CreateEnum
CREATE TYPE "nav_zone_module" AS ENUM ('TOPBAR', 'ACCOUNT', 'ADMIN_SIDEBAR');

-- CreateEnum
CREATE TYPE "gender_pet" AS ENUM ('Macho', 'Hembra');

-- CreateEnum
CREATE TYPE "action_permission" AS ENUM ('Leer', 'Crear', 'Actualizar', 'Eliminar', 'Guardar');

-- CreateEnum
CREATE TYPE "account_type_donationBankAccount" AS ENUM ('Monetaria', 'Ahorro', 'Préstamo', 'Tarjeta de crédito');

-- CreateEnum
CREATE TYPE "donation_type_donation" AS ENUM ('Monetaria', 'Especie');

-- CreateEnum
CREATE TYPE "status_proyecto" AS ENUM ('Activo', 'Finalizado');

-- CreateEnum
CREATE TYPE "category_proyectoFoto" AS ENUM ('Antes', 'Durante', 'Después');

-- CreateEnum
CREATE TYPE "story_category" AS ENUM ('Finales_felices', 'Camino_arcoiris');

-- CreateEnum
CREATE TYPE "story_status" AS ENUM ('Borrador', 'Publicada', 'Archivada');

-- CreateEnum
CREATE TYPE "status_pet" AS ENUM ('Disponible', 'En_tratamiento', 'Incapacitado', 'Fallecido', 'Retirado', 'Adoptado');

-- CreateTable
CREATE TABLE "module" (
    "id" SERIAL NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "icon" VARCHAR(100) NOT NULL,
    "order" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL,
    "nav_zone" "nav_zone_module" NOT NULL,
    "nav_audience" "nav_audience_module" NOT NULL,

    CONSTRAINT "pk_module" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pet" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "gender" "gender_pet" NOT NULL,
    "pet_species_id" INTEGER NOT NULL,
    "birthdate" DATE NOT NULL,
    "size" VARCHAR(50) NOT NULL,
    "color" VARCHAR(50) NOT NULL,
    "vaccinated" BOOLEAN NOT NULL DEFAULT false,
    "sterilized" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "race" VARCHAR(100),
    "creation_date" TIMESTAMP(6) NOT NULL,
    "creator_id" INTEGER NOT NULL,
    "update_date" TIMESTAMP(6) NOT NULL,
    "updater_id" INTEGER NOT NULL,
    "status" "status_pet" NOT NULL DEFAULT 'Disponible',

    CONSTRAINT "pet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "petSpecies" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "creation_date" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creator_id" INTEGER NOT NULL,
    "update_date" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updater_id" INTEGER NOT NULL,

    CONSTRAINT "petcategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pet_images" (
    "id" SERIAL NOT NULL,
    "pet_id" INTEGER NOT NULL,
    "path" VARCHAR(100) NOT NULL,
    "creation_date" TIMESTAMP(6) NOT NULL,
    "creator_id" INTEGER NOT NULL,
    "update_date" TIMESTAMP(6) NOT NULL,
    "updater_id" INTEGER NOT NULL,

    CONSTRAINT "pet_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(100),
    "active" BOOLEAN DEFAULT true,
    "created_in" TIMESTAMP(6) NOT NULL,
    "its_administrative" BOOLEAN NOT NULL DEFAULT false,
    "is_system" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "pk_rol" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" SERIAL NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(100) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "role_id" INTEGER NOT NULL,
    "registration_date" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "it_is_verified" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "profile_public_id" TEXT,
    "phone" VARCHAR(25),
    "profile_version" VARCHAR(100),

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(200) NOT NULL,
    "module_id" INTEGER NOT NULL,
    "action" "action_permission" NOT NULL,
    "created_in" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "pk_permission" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_role" (
    "id" SERIAL NOT NULL,
    "role_id" INTEGER NOT NULL,
    "permission_id" INTEGER NOT NULL,
    "created_in" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "pk_permission_role" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "passwordResetToken" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "token" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "passwordresettoken_pk" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accountVerificationToken" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "token" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "accountverificationtoken_pk" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "formQuestion" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "section" VARCHAR(100),
    "question_text" TEXT NOT NULL,
    "field_type" VARCHAR(100) NOT NULL,
    "options" JSONB,
    "required" BOOLEAN NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL,

    CONSTRAINT "pk_formQuestions" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adoptionApplication" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "pet_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "submitted_at" TIMESTAMP(6) NOT NULL,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "rejection_reason" TEXT,

    CONSTRAINT "pk_adoptionApplications" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applicationAnswer" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "application_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "answer_value" TEXT NOT NULL,

    CONSTRAINT "pk_applicationanswers" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commitmentAgreement" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "application_id" TEXT NOT NULL,
    "agreement_text" TEXT NOT NULL,
    "accepted" BOOLEAN NOT NULL,
    "ip_address" VARCHAR,
    "signed_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "commitmentagreement_pk" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "savedPet" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "user_id" INTEGER NOT NULL,
    "pet_id" INTEGER NOT NULL,
    "saved_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "savedpet_pk" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "donation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" INTEGER,
    "donor_name" VARCHAR(100),
    "donor_email" VARCHAR(100),
    "donor_phone" VARCHAR(25),
    "donation_type" "donation_type_donation" NOT NULL,
    "declared_amount" DECIMAL(10,2),
    "item_description" TEXT,
    "bank_account_id" INTEGER,
    "status" VARCHAR(50) NOT NULL,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "is_anonymous" BOOLEAN NOT NULL DEFAULT false,
    "submitted_at" TIMESTAMP(6) NOT NULL,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "rejection_reason" TEXT,
    "reviewed_by" INTEGER,
    "comment" TEXT,
    "reference_number" VARCHAR(50),
    "confirmed_amount" DECIMAL(10,2),
    "patrocinador_id" INTEGER,
    "proyecto_id" INTEGER,
    "receipt_url" VARCHAR(255),

    CONSTRAINT "donation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "donationBankAccount" (
    "id" SERIAL NOT NULL,
    "bank_name" VARCHAR(100) NOT NULL,
    "account_type" "account_type_donationBankAccount" NOT NULL,
    "account_number" VARCHAR(50) NOT NULL,
    "account_holder" VARCHAR(100),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "creation_date" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creator_id" INTEGER NOT NULL,
    "update_date" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updater_id" INTEGER NOT NULL,

    CONSTRAINT "donationBankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "needSupplies" (
    "id" SERIAL NOT NULL,
    "description" VARCHAR(150) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "creation_date" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creator_id" INTEGER NOT NULL,
    "update_date" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updater_id" INTEGER NOT NULL,

    CONSTRAINT "insumoNecesitado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT NOT NULL,
    "goal" VARCHAR(150),
    "status" "status_proyecto" NOT NULL DEFAULT 'Activo',
    "creation_date" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creator_id" INTEGER NOT NULL,
    "update_date" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updater_id" INTEGER NOT NULL,
    "progress" INTEGER,

    CONSTRAINT "proyecto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_photo" (
    "id" SERIAL NOT NULL,
    "proyecto_id" INTEGER NOT NULL,
    "url" VARCHAR(255) NOT NULL,
    "category" "category_proyectoFoto" NOT NULL,
    "creation_date" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creator_id" INTEGER NOT NULL,
    "update_date" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updater_id" INTEGER NOT NULL,

    CONSTRAINT "proyectoFoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sponsor" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "logo_url" VARCHAR(255),
    "website" VARCHAR(150),
    "contact" VARCHAR(150),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "creation_date" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creator_id" INTEGER NOT NULL,
    "update_date" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updater_id" INTEGER NOT NULL,

    CONSTRAINT "patrocinador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "story" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "slug" VARCHAR(180) NOT NULL,
    "summary" VARCHAR(300),
    "body" TEXT NOT NULL,
    "category" "story_category" NOT NULL,
    "status" "story_status" NOT NULL DEFAULT 'Borrador',
    "event_date" DATE,
    "published_at" TIMESTAMP(6),
    "pet_id" INTEGER,
    "creation_date" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creator_id" INTEGER NOT NULL,
    "update_date" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updater_id" INTEGER NOT NULL,

    CONSTRAINT "pk_story" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "story_image" (
    "id" SERIAL NOT NULL,
    "story_id" INTEGER NOT NULL,
    "path" VARCHAR(150) NOT NULL,
    "alt_text" VARCHAR(150),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_cover" BOOLEAN NOT NULL DEFAULT false,
    "creation_date" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creator_id" INTEGER NOT NULL,

    CONSTRAINT "pk_story_image" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "data" JSONB NOT NULL,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_session" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rateLimitBucket" (
    "key" VARCHAR(150) NOT NULL,
    "window_start" TIMESTAMP(6) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "rateLimitBucket_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "pet_name_idx" ON "pet"("name");

-- CreateIndex
CREATE INDEX "pet_status_idx" ON "pet"("status");

-- CreateIndex
CREATE INDEX "pet_gender_idx" ON "pet"("gender");

-- CreateIndex
CREATE INDEX "pet_pet_species_id_idx" ON "pet"("pet_species_id");

-- CreateIndex
CREATE INDEX "pet_images_pet_id_idx" ON "pet_images"("pet_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_username_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_unique" ON "user"("profile_public_id");

-- CreateIndex
CREATE UNIQUE INDEX "passwordresettoken_unique" ON "passwordResetToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "accountverificationtoken_unique" ON "accountVerificationToken"("token");

-- CreateIndex
CREATE INDEX "adoptionApplication_pet_id_idx" ON "adoptionApplication"("pet_id");

-- CreateIndex
CREATE INDEX "adoptionApplication_user_id_idx" ON "adoptionApplication"("user_id");

-- CreateIndex
CREATE INDEX "adoptionApplication_status_idx" ON "adoptionApplication"("status");

-- CreateIndex
CREATE INDEX "adoptionApplication_submitted_at_idx" ON "adoptionApplication"("submitted_at");

-- CreateIndex
CREATE UNIQUE INDEX "savedpet_user_pet_unique" ON "savedPet"("user_id", "pet_id");

-- CreateIndex
CREATE UNIQUE INDEX "story_slug_unique" ON "story"("slug");

-- CreateIndex
CREATE INDEX "story_category_status_published_at_idx" ON "story"("category", "status", "published_at");

-- CreateIndex
CREATE INDEX "story_pet_id_idx" ON "story"("pet_id");

-- CreateIndex
CREATE INDEX "story_image_story_id_sort_order_idx" ON "story_image"("story_id", "sort_order");

-- CreateIndex
CREATE INDEX "session_expires_at_idx" ON "session"("expires_at");

-- AddForeignKey
ALTER TABLE "pet" ADD CONSTRAINT "fk_creator_pet" FOREIGN KEY ("creator_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "pet" ADD CONSTRAINT "fk_species_pet" FOREIGN KEY ("pet_species_id") REFERENCES "petSpecies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "pet" ADD CONSTRAINT "fk_updater_pet" FOREIGN KEY ("updater_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "petSpecies" ADD CONSTRAINT "fk_creator_petcategory" FOREIGN KEY ("creator_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "petSpecies" ADD CONSTRAINT "pk_updater_petcategory" FOREIGN KEY ("updater_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "pet_images" ADD CONSTRAINT "fk_creator_pet_images" FOREIGN KEY ("creator_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "pet_images" ADD CONSTRAINT "fk_pet_pet_images" FOREIGN KEY ("pet_id") REFERENCES "pet"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "pet_images" ADD CONSTRAINT "fk_updater_pet_images" FOREIGN KEY ("updater_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_rol_fk" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "permission" ADD CONSTRAINT "fk_module_permission" FOREIGN KEY ("module_id") REFERENCES "module"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "permission_role" ADD CONSTRAINT "fk_permission_permission_role" FOREIGN KEY ("permission_id") REFERENCES "permission"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "permission_role" ADD CONSTRAINT "fk_role_permission_role" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "passwordResetToken" ADD CONSTRAINT "fk_user_passwordresettoken" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "accountVerificationToken" ADD CONSTRAINT "fk_user_accountverificationtoken" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "adoptionApplication" ADD CONSTRAINT "fk_pet_adoptionapplications" FOREIGN KEY ("pet_id") REFERENCES "pet"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "adoptionApplication" ADD CONSTRAINT "fk_user_adoptionapplications" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "applicationAnswer" ADD CONSTRAINT "applicationanswers_applicationanswers_fk" FOREIGN KEY ("application_id") REFERENCES "adoptionApplication"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "applicationAnswer" ADD CONSTRAINT "applicationanswers_formquestions_fk" FOREIGN KEY ("question_id") REFERENCES "formQuestion"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "commitmentAgreement" ADD CONSTRAINT "commitmentagreement_adoptionapplication_fk" FOREIGN KEY ("application_id") REFERENCES "adoptionApplication"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "savedPet" ADD CONSTRAINT "savedpet_pet_fk" FOREIGN KEY ("pet_id") REFERENCES "pet"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "savedPet" ADD CONSTRAINT "savedpet_user_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "donation" ADD CONSTRAINT "fk_bankaccount_donation" FOREIGN KEY ("bank_account_id") REFERENCES "donationBankAccount"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "donation" ADD CONSTRAINT "fk_patrocinador_donation" FOREIGN KEY ("patrocinador_id") REFERENCES "sponsor"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "donation" ADD CONSTRAINT "fk_proyecto_donation" FOREIGN KEY ("proyecto_id") REFERENCES "project"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "donation" ADD CONSTRAINT "fk_reviewer_donation" FOREIGN KEY ("reviewed_by") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "donation" ADD CONSTRAINT "fk_user_donation" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "donationBankAccount" ADD CONSTRAINT "fk_creator_donationBankAccount" FOREIGN KEY ("creator_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "donationBankAccount" ADD CONSTRAINT "fk_updater_donationBankAccount" FOREIGN KEY ("updater_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "needSupplies" ADD CONSTRAINT "fk_creator_insumoNecesitado" FOREIGN KEY ("creator_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "needSupplies" ADD CONSTRAINT "fk_updater_insumoNecesitado" FOREIGN KEY ("updater_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "fk_creator_proyecto" FOREIGN KEY ("creator_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "fk_updater_proyecto" FOREIGN KEY ("updater_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "project_photo" ADD CONSTRAINT "fk_creator_proyectoFoto" FOREIGN KEY ("creator_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "project_photo" ADD CONSTRAINT "fk_proyecto_proyectoFoto" FOREIGN KEY ("proyecto_id") REFERENCES "project"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "project_photo" ADD CONSTRAINT "fk_updater_proyectoFoto" FOREIGN KEY ("updater_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sponsor" ADD CONSTRAINT "fk_creator_patrocinador" FOREIGN KEY ("creator_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sponsor" ADD CONSTRAINT "fk_updater_patrocinador" FOREIGN KEY ("updater_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "story" ADD CONSTRAINT "fk_pet_story" FOREIGN KEY ("pet_id") REFERENCES "pet"("id") ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "story" ADD CONSTRAINT "fk_creator_story" FOREIGN KEY ("creator_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "story" ADD CONSTRAINT "fk_updater_story" FOREIGN KEY ("updater_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "story_image" ADD CONSTRAINT "fk_story_story_image" FOREIGN KEY ("story_id") REFERENCES "story"("id") ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "story_image" ADD CONSTRAINT "fk_creator_story_image" FOREIGN KEY ("creator_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

