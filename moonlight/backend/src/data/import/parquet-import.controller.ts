import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { ParquetImportService } from './parquet-import.service';
import {
  ParquetFileCandidateDTO,
  ParquetImportPreviewDTO,
  ParquetImportApplyRequestDTO,
} from '../../shared/dto/parquet-import.dto';

@Controller('data/import')
export class ParquetImportController {
  constructor(private readonly importService: ParquetImportService) {}

  @Get('scan')
  async scanDirectory(
    @Query('baseDir') baseDir: string,
  ): Promise<ParquetFileCandidateDTO[]> {
    return this.importService.scanDirectoryForParquet(baseDir);
  }

  @Post('preview')
  async previewFiles(
    @Body() body: { files: ParquetFileCandidateDTO[] },
  ): Promise<ParquetImportPreviewDTO[]> {
    const previews: ParquetImportPreviewDTO[] = [];

    for (const file of body.files) {
      const preview = await this.importService.buildPreviewForFile(file);
      previews.push(preview);
    }

    return previews;
  }

  @Post('apply')
  async applyMappings(
    @Body() request: ParquetImportApplyRequestDTO,
  ): Promise<{ status: string }> {
    await this.importService.applyMappings(request);
    return { status: 'OK' };
  }
}
