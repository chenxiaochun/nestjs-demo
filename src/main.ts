import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { TtsRelayService } from './speech/tts-relay.service';
import { WebSocketServer } from 'ws';

declare const module: { hot: { accept: () => void; dispose: (callback: () => void) => void } };

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const ttsRelayService = app.get(TtsRelayService);
  const server = app.getHttpServer();

  const ttsWss = new WebSocketServer({
    server,
    path: '/speech/tts/ws',
  });
  ttsWss.on('connection', (socket, request) => {
    // request.url 是相对路径（如 /speech/tts/ws），必须提供 base
    const reqUrl = new URL(request.url ?? '/', 'http://localhost');
    const wantedSessionId = reqUrl.searchParams.get('sessionId') ?? undefined;
    const sessionId = ttsRelayService.registerClient(socket, wantedSessionId);

    socket.on('close', () => {
      ttsRelayService.unregisterClient(sessionId);
    });
  });

  await app.listen(process.env.PORT ?? 3000);

  if (module.hot) {
    module.hot.accept();
    module.hot.dispose(() => app.close());
  }
}
bootstrap();
