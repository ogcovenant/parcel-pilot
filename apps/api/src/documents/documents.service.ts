import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Document } from './document.entity';

@Injectable()
export class DocumentsService {
  constructor(
    @Inject('DATABASE_CONNECTION') private readonly dataSource: DataSource,
  ) {}

  private repo() {
    return this.dataSource.getRepository(Document);
  }

  async findByDocumentId(documentId: string): Promise<Document | null> {
    return this.repo().findOne({ where: { documentId } });
  }

  async findAll(): Promise<Document[]> {
    return this.repo().find({ relations: { customerAccount: true } });
  }

  async findByIds(ids: string[]): Promise<Document[]> {
    if (ids.length === 0) return [];
    return this.repo().find({ where: ids.map((id) => ({ id })) });
  }
}
