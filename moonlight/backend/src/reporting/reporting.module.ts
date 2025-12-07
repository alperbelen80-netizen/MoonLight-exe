import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BacktestRun } from '../database/entities/backtest-run.entity';
import { BacktestTrade } from '../database/entities/backtest-trade.entity';
import { BacktestReportingService } from './backtest-reporting.service';
import { ReportExportService } from './report-export.service';
import { AdvancedExcelService } from './advanced-excel.service';
import { ReportingController } from './reporting.controller';

@Module({
  imports: [TypeOrmModule.forFeature([BacktestRun, BacktestTrade])],
  controllers: [ReportingController],
  providers: [BacktestReportingService, ReportExportService, AdvancedExcelService],
  exports: [BacktestReportingService, ReportExportService, AdvancedExcelService],
})
export class ReportingModule {}
