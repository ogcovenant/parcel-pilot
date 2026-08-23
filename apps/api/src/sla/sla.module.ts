import { Module } from '@nestjs/common';
import { SlaService } from './sla.service';
import { SeverityClassifier } from './severity-classifier';

@Module({
  providers: [SlaService, SeverityClassifier],
  exports: [SlaService, SeverityClassifier],
})
export class SlaModule {}
