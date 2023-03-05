export class ChannelAp1677980761411 {
    name = 'ChannelAp1677980761411'

    async up(queryRunner) {
        await queryRunner.query(`DROP INDEX "public"."IDX_2cd3b2a6b4cf0b910b260afe08"`);
        await queryRunner.query(`ALTER TABLE "channel" ADD "uri" character varying(512)`);
        await queryRunner.query(`COMMENT ON COLUMN "channel"."uri" IS 'The URI of the Channel. It will be null if the origin of the channel is local.'`);
        await queryRunner.query(`COMMENT ON COLUMN "user"."isRoot" IS 'Whether the User is the root.'`);
        await queryRunner.query(`COMMENT ON COLUMN "ad"."startsAt" IS 'The expired date of the Ad.'`);
        await queryRunner.query(`CREATE INDEX "IDX_a9021cc2e1feb5f72d3db6e9f5" ON "abuse_user_report" ("targetUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_3fcc2c589eaefc205e0714b99c" ON "ad" ("startsAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_bd0e56edb9ccb54f92b3693d14" ON "channel" ("uri") `);
        await queryRunner.query(`CREATE INDEX "IDX_f7b9d338207e40e768e4a5265a" ON "instance" ("firstRetrievedAt") `);
        await queryRunner.query(`ALTER TABLE "abuse_user_report" ADD CONSTRAINT "FK_a9021cc2e1feb5f72d3db6e9f5f" FOREIGN KEY ("targetUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "abuse_user_report" DROP CONSTRAINT "FK_a9021cc2e1feb5f72d3db6e9f5f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f7b9d338207e40e768e4a5265a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bd0e56edb9ccb54f92b3693d14"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3fcc2c589eaefc205e0714b99c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a9021cc2e1feb5f72d3db6e9f5"`);
        await queryRunner.query(`COMMENT ON COLUMN "ad"."startsAt" IS NULL`);
        await queryRunner.query(`COMMENT ON COLUMN "user"."isRoot" IS 'Whether the User is the admin.'`);
        await queryRunner.query(`COMMENT ON COLUMN "channel"."uri" IS 'The URI of the Channel. It will be null if the origin of the channel is local.'`);
        await queryRunner.query(`ALTER TABLE "channel" DROP COLUMN "uri"`);
        await queryRunner.query(`CREATE INDEX "IDX_2cd3b2a6b4cf0b910b260afe08" ON "instance" ("firstRetrievedAt") `);
    }
}
