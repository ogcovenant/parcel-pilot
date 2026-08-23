import 'reflect-metadata';
/**
 * Run deterministic issue detection and persist detected hypotheses.
 *
 * Usage: pnpm --filter @parel-pilot/api detect:issues
 */
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { IssuesService } from '../src/issues/issues.service';

const SCHEMA = join(__dirname, '../src/database/schema.sql');

async function main() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USER ?? 'parelpilot',
    password: process.env.DB_PASSWORD ?? 'parelpilot_dev',
    database: process.env.DB_NAME ?? 'parcel_pilot',
    entities: [join(__dirname, '../src/**/*.entity.ts')],
    synchronize: false,
  });
  await dataSource.initialize();
  await dataSource.query(readFileSync(SCHEMA, 'utf8'));

  const configService = new ConfigService({
    app: { datasetAsOf: process.env.DATASET_AS_OF ?? '2026-08-16T11:00:00+05:30' },
  });
  const issuesService = new IssuesService(dataSource, configService);

  const detected = await issuesService.detectIssues();
  const saved = await issuesService.saveIssues(detected);
  console.log(`[issues] detected ${detected.length}, saved ${saved.length}`);
  for (const issue of saved) {
    console.log(`  ${issue.issueId} [${issue.type}] ${issue.title} (confidence ${issue.confidence})`);
  }

  await dataSource.destroy();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});