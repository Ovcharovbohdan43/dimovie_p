import {
  Body,
  Controller,
  Get,
  Logger,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { CatalogInfo, CatalogStreamResult } from '@dimovie/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RezkaCatalogService } from './rezka.service';
import { ParseCatalogDto } from './dto/parse-catalog.dto';
import { ResolveStreamDto } from './dto/resolve-stream.dto';

@Controller('catalog')
export class CatalogController {
  private readonly logger = new Logger(CatalogController.name);

  constructor(private readonly rezka: RezkaCatalogService) {}

  @Post('rezka/parse')
  @UseGuards(JwtAuthGuard)
  parse(@Body() dto: ParseCatalogDto): Promise<CatalogInfo> {
    this.logger.log(`POST /catalog/rezka/parse url=${dto.url}`);
    return this.rezka.parseCatalog(dto.url);
  }

  @Post('rezka/stream')
  @UseGuards(JwtAuthGuard)
  resolveStream(@Body() dto: ResolveStreamDto): Promise<CatalogStreamResult> {
    this.logger.log(
      `POST /catalog/rezka/stream catalog=${dto.catalogUrl} tr=${dto.translationId}`,
    );
    return this.rezka.resolveStream(
      dto.catalogUrl,
      dto.translationId,
      dto.season,
      dto.episode,
    );
  }

  @Get('proxy')
  async proxy(
    @Query('url') url: string,
    @Query('origin') origin: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    await this.rezka.proxyStream(url, origin, req, res);
  }
}
