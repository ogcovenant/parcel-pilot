import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from './document.entity';
import { DocumentChunk } from './document-chunk.entity';
import { DocumentsService } from './documents.service';

@Module({
  imports: [TypeOrmModule.forFeature([Document, DocumentChunk])],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
