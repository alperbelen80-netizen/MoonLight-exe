import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigSnapshot } from '../database/entities/config-snapshot.entity';
import { ConfigSnapshotService } from './config-snapshot.service';

@Module({
  imports: [TypeOrmModule.forFeature([ConfigSnapshot])],
  providers: [ConfigSnapshotService],
  exports: [ConfigSnapshotService],
})
export class ConfigModule {}
