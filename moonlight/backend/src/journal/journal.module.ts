import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JournalController } from './journal.controller';
import { LiveSignal } from '../database/entities/live-signal.entity';

@Module({
  imports: [TypeOrmModule.forFeature([LiveSignal])],
  controllers: [JournalController],
})
export class JournalModule {}
