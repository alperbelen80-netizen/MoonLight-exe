import { Test, TestingModule } from '@nestjs/testing';
import { ParquetImportService } from '../../../data/import/parquet-import.service';
import { Timeframe } from '../../../shared/enums/timeframe.enum';
import * as fs from 'fs/promises';

jest.mock('fs/promises');

describe('ParquetImportService', () => {
  let service: ParquetImportService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ParquetImportService],
    }).compile();

    service = module.get<ParquetImportService>(ParquetImportService);
    jest.clearAllMocks();
  });

  it('should detect symbol and tf from filename (XAUUSD_1s_2025-01-18.parquet)', async () => {
    const file = {
      full_path: '/test/XAUUSD_1s_2025-01-18.parquet',
      size_bytes: 1024,
      modified_at_utc: new Date().toISOString(),
    };

    const preview = await service.buildPreviewForFile(file);

    expect(preview.detected_symbol).toBe('XAUUSD');
    expect(preview.detected_tf).toBe(Timeframe.ONE_SECOND);
    expect(preview.suggestions).toHaveLength(0);
  });

  it('should detect symbol and tf from filename (EURUSD_5m_2025-01-18.parquet)', async () => {
    const file = {
      full_path: '/test/EURUSD_5m_2025-01-18.parquet',
      size_bytes: 2048,
      modified_at_utc: new Date().toISOString(),
    };

    const preview = await service.buildPreviewForFile(file);

    expect(preview.detected_symbol).toBe('EURUSD');
    expect(preview.detected_tf).toBe(Timeframe.FIVE_MINUTE);
  });

  it('should suggest error for unrecognized pattern', async () => {
    const file = {
      full_path: '/test/random_filename.parquet',
      size_bytes: 512,
      modified_at_utc: new Date().toISOString(),
    };

    const preview = await service.buildPreviewForFile(file);

    expect(preview.detected_symbol).toBeUndefined();
    expect(preview.detected_tf).toBeUndefined();
    expect(preview.suggestions.length).toBeGreaterThan(0);
  });

  it('should apply mappings and copy files to target paths', async () => {
    const mockMkdir = fs.mkdir as jest.Mock;
    const mockCopyFile = fs.copyFile as jest.Mock;

    mockMkdir.mockResolvedValue(undefined);
    mockCopyFile.mockResolvedValue(undefined);

    const request = {
      base_dir: '/data',
      mappings: [
        {
          source_path: '/import/XAUUSD_1s_2025-01-18.parquet',
          symbol: 'XAUUSD',
          tf: Timeframe.ONE_SECOND,
          date: '2025-01-18',
        },
      ],
    };

    await service.applyMappings(request);

    expect(mockMkdir).toHaveBeenCalled();
    expect(mockCopyFile).toHaveBeenCalledWith(
      '/import/XAUUSD_1s_2025-01-18.parquet',
      expect.stringContaining('/data/raw/XAUUSD/1s/2025-01-18.parquet'),
    );
  });
});
