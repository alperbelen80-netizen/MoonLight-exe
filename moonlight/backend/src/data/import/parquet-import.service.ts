import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  ParquetFileCandidateDTO,
  ParquetImportPreviewDTO,
  ParquetImportApplyRequestDTO,
} from '../../shared/dto/parquet-import.dto';
import { Timeframe } from '../../shared/enums/timeframe.enum';

@Injectable()
export class ParquetImportService {
  private readonly logger = new Logger(ParquetImportService.name);

  async scanDirectoryForParquet(
    baseDir: string,
  ): Promise<ParquetFileCandidateDTO[]> {
    const candidates: ParquetFileCandidateDTO[] = [];

    try {
      const files = await fs.readdir(baseDir, { withFileTypes: true });

      for (const file of files) {
        if (file.isFile() && file.name.endsWith('.parquet')) {
          const fullPath = path.join(baseDir, file.name);
          const stats = await fs.stat(fullPath);

          candidates.push({
            full_path: fullPath,
            size_bytes: stats.size,
            modified_at_utc: stats.mtime.toISOString(),
          });
        }
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to scan directory ${baseDir}: ${error?.message || String(error)}`,
      );
    }

    return candidates;
  }

  async buildPreviewForFile(
    file: ParquetFileCandidateDTO,
  ): Promise<ParquetImportPreviewDTO> {
    const fileName = path.basename(file.full_path, '.parquet');
    const suggestions: string[] = [];

    const pattern = /^([A-Z]{3,10})_([0-9]+[smhd])_([0-9]{4}-[0-9]{2}-[0-9]{2})$/;
    const match = fileName.match(pattern);

    let detectedSymbol: string | undefined;
    let detectedTf: Timeframe | undefined;

    if (match) {
      detectedSymbol = match[1];
      const tfCandidate = match[2] as Timeframe;

      if (Object.values(Timeframe).includes(tfCandidate)) {
        detectedTf = tfCandidate;
      } else {
        suggestions.push(`TF "${tfCandidate}" not recognized, check pattern`);
      }
    } else {
      suggestions.push('Filename does not match expected pattern: SYMBOL_TF_YYYY-MM-DD.parquet');
    }

    return {
      file,
      detected_symbol: detectedSymbol,
      detected_tf: detectedTf,
      suggestions,
    };
  }

  async applyMappings(req: ParquetImportApplyRequestDTO): Promise<void> {
    const { base_dir, mappings } = req;

    for (const mapping of mappings) {
      const { source_path, symbol, tf, date } = mapping;

      const targetDate = date || new Date().toISOString().split('T')[0];
      const targetPath = path.join(
        base_dir,
        'raw',
        symbol,
        tf,
        `${targetDate}.parquet`,
      );

      const targetDir = path.dirname(targetPath);
      await fs.mkdir(targetDir, { recursive: true });

      await fs.copyFile(source_path, targetPath);

      this.logger.log(
        `Imported ${source_path} -> ${targetPath}`,
      );
    }

    this.logger.log(`Import complete: ${mappings.length} files`);
  }
}
