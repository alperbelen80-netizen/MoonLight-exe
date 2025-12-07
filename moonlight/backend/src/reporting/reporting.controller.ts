import { Controller, Get, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { BacktestReportingService } from './backtest-reporting.service';
import { ReportExportService } from './report-export.service';
import { AdvancedExcelService } from './advanced-excel.service';
import { BacktestAdvancedReportDTO } from '../shared/dto/backtest-report.dto';

@Controller('reporting')
export class ReportingController {
  constructor(
    private readonly backtestReportingService: BacktestReportingService,
    private readonly reportExportService: ReportExportService,
    private readonly advancedExcelService: AdvancedExcelService,
  ) {}

  @Get('backtest/:runId/advanced')
  async getAdvancedReport(
    @Param('runId') runId: string,
  ): Promise<BacktestAdvancedReportDTO> {
    return this.backtestReportingService.buildAdvancedReport(runId);
  }

  @Get('backtest/:runId/export/csv')
  async exportCsv(@Param('runId') runId: string, @Res() res: Response) {
    const { filename, content } =
      await this.reportExportService.exportBacktestToCsv(runId);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  }

  @Get('backtest/:runId/export/xlsx')
  async exportXlsx(@Param('runId') runId: string, @Res() res: Response) {
    const { filename, buffer } =
      await this.reportExportService.exportBacktestToXlsx(runId);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Get('backtest/:runId/export/xlsx-advanced')
  async exportAdvancedXlsx(
    @Param('runId') runId: string,
    @Res() res: Response,
  ) {
    const { filename, buffer } =
      await this.advancedExcelService.generateAdvanced11SheetExcel(runId);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}
