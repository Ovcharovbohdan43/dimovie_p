import { Module } from '@nestjs/common';
import { VoiceGateway } from './voice.gateway';
import { VoiceService } from './voice.service';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [RealtimeModule],
  providers: [VoiceGateway, VoiceService],
  exports: [VoiceService],
})
export class VoiceModule {}
