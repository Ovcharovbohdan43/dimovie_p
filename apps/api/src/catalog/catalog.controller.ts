import {
  Body,
  Controller,
  Get,
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
  constructor(private readonly rezka: RezkaCatalogService) {}

  @Post('rezka/parse')
  @UseGuards(JwtAuthGuard)
  parse(@Body() dto: ParseCatalogDto): Promise<CatalogInfo> {
    return this.rezka.parseCatalog(dto.url);
  }

  @Post('rezka/stream')
  @UseGuards(JwtAuthGuard)
  resolveStream(@Body() dto: ResolveStreamDto): Promise<CatalogStreamResult> {
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
