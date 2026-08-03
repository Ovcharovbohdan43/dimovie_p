import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { RezkaCatalogService } from './rezka.service';

@Module({
  controllers: [CatalogController],
  providers: [RezkaCatalogService],
  exports: [RezkaCatalogService],
})
export class CatalogModule {}
