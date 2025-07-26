import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { CodeService } from '../services/code.service';

interface ConnectedUser {
  id: string;
  roomId: string;
  nickname?: string;
  cursorPosition?: number;
}

@WebSocketGateway({
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') ||
           (process.env.NODE_ENV === 'production' ?
            process.env.FRONTEND_URL :
            ['http://localhost:3000', 'http://127.0.0.1:3000']),
    credentials: true,
    methods: ['GET', 'POST'],
  },
  namespace: '/ws'
})
export class CodeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedUsers = new Map<string, ConnectedUser>();
  private roomUsers = new Map<string, Set<string>>();
  private rateLimiter = new Map<string, number>();

  constructor(private codeService: CodeService) {}

  handleConnection(client: Socket) {
    // Логирование событий для отладки в режиме разработки
    if (process.env.NODE_ENV === 'development') {
      client.onAny((eventName, ...args) => {
        console.log(`Received event: ${eventName}`, args);
      });
    }
  }

  handleDisconnect(client: Socket) {
    const user = this.connectedUsers.get(client.id);
    if (user) {
      this.leaveRoom(client, user.roomId);
      this.connectedUsers.delete(client.id);
    }
  }

  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; nickname?: string },
  ) {
    const { roomId, nickname } = data;
    const codeFile = await this.codeService.getCodeFile(roomId);
    if (!codeFile) {
      client.emit('error', { message: 'Room not found' });
      return;
    }

    if (new Date() > codeFile.expiresAt) {
      client.emit('error', { message: 'Room has expired' });
      return;
    }

    const existingUser = this.connectedUsers.get(client.id);
    if (existingUser) {
      this.leaveRoom(client, existingUser.roomId);
    }

    client.join(roomId);

    const user: ConnectedUser = {
      id: client.id,
      roomId,
      nickname: nickname || `User${Math.floor(Math.random() * 1000)}`,
    };

    this.connectedUsers.set(client.id, user);

    if (!this.roomUsers.has(roomId)) {
      this.roomUsers.set(roomId, new Set());
    }
    this.roomUsers.get(roomId)!.add(client.id);

    client.emit('joined_room', {
      roomId,
      code: codeFile.code,
      language: codeFile.language,
    });

    const roomUsersList = Array.from(this.roomUsers.get(roomId)!)
      .map(userId => this.connectedUsers.get(userId))
      .filter(Boolean);

    // Отправляем обновленный список пользователей всем в комнате
    const currentUsers = roomUsersList.map(u => ({ id: u!.id, nickname: u!.nickname }));
    this.server.to(roomId).emit('user_joined', {
      user: { id: user.id, nickname: user.nickname },
      users: currentUsers,
    });

    client.emit('user_joined', {
      user: { id: user.id, nickname: user.nickname },
      users: currentUsers,
    });
  }

  @SubscribeMessage('leave_room')
  handleLeaveRoom(@ConnectedSocket() client: Socket) {
    const user = this.connectedUsers.get(client.id);
    if (user) {
      this.leaveRoom(client, user.roomId);
    }
  }

  @SubscribeMessage('code_update')
  async handleCodeUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; code: string; language?: string },
  ) {
    // Rate limiting: максимум 10 обновлений в секунду
    // const now = Date.now();
    // const lastUpdate = this.rateLimiter.get(client.id) || 0;

    // if (now - lastUpdate < 100) {
    //   client.emit('error', { message: 'Rate limit exceeded' });
    //   return;
    // }

    // this.rateLimiter.set(client.id, now);

    const { roomId, code, language } = data;
    const user = this.connectedUsers.get(client.id);

    if (!user || user.roomId !== roomId) {
      client.emit('error', { message: 'Not in room' });
      return;
    }

    // Валидация данных
    if (typeof code !== 'string' || code.length > 1000000) { // Максимум 1MB
      client.emit('error', { message: 'Invalid code data' });
      return;
    }

    try {
      // Получаем текущий код для трансформации курсоров
      const oldCodeFile = await this.codeService.getCodeFile(roomId);
      const oldCode = oldCodeFile?.code || '';

      await this.codeService.updateCodeFile(roomId, code, language);

      // Получаем позиции курсоров всех пользователей в комнате
      const roomUsersSet = this.roomUsers.get(roomId);
      const allCursors = roomUsersSet ? Array.from(roomUsersSet)
        .map(userId => {
          const u = this.connectedUsers.get(userId);
          return u && u.cursorPosition !== undefined ? {
            userId: u.id,
            position: u.cursorPosition,
            nickname: u.nickname
          } : null;
        })
        .filter(Boolean) : [];

      // Отправляем обновление всем пользователям в комнате кроме отправителя
      client.to(roomId).emit('code_updated', {
        code,
        language,
        userId: client.id,
        userNickname: user.nickname,
        oldCode,
        allCursors
      });
    } catch (error) {
      console.error('Failed to update code:', error);
      client.emit('error', { message: 'Failed to update code' });
    }
  }

  @SubscribeMessage('language_change')
  async handleLanguageChange(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; language: string },
  ) {
    const { roomId, language } = data;
    const user = this.connectedUsers.get(client.id);

    if (!user || user.roomId !== roomId) {
      client.emit('error', { message: 'Not in room' });
      return;
    }

    try {
      const codeFile = await this.codeService.getCodeFile(roomId);
      if (codeFile) {
        await this.codeService.updateCodeFile(roomId, codeFile.code, language);

        this.server.to(roomId).emit('language_changed', {
          language,
          userId: client.id,
          userNickname: user.nickname,
        });
      }
    } catch (error) {
      client.emit('error', { message: 'Failed to change language' });
    }
  }


  @SubscribeMessage('cursor_update')
  handleCursorUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; position: number },
  ) {
    const { roomId, position } = data;
    const user = this.connectedUsers.get(client.id);

    if (!user || user.roomId !== roomId) {
      client.emit('error', { message: 'Not in room' });
      return;
    }

    // Валидация позиции курсора
    if (typeof position !== 'number' || position < 0 || position > 1000000) {
      client.emit('error', { message: 'Invalid cursor position' });
      return;
    }

    // Обновляем позицию курсора пользователя на сервере
    user.cursorPosition = position;

    // Отправляем обновление позиции курсора всем остальным пользователям в комнате
    client.to(roomId).emit('cursor_updated', {
      userId: client.id,
      position,
      userNickname: user.nickname,
    });
  }

  private leaveRoom(client: Socket, roomId: string) {
    client.leave(roomId);

    const roomUsersSet = this.roomUsers.get(roomId);
    if (roomUsersSet) {
      roomUsersSet.delete(client.id);

      const user = this.connectedUsers.get(client.id);
      if (user) {
        const remainingUsers = Array.from(roomUsersSet)
          .map(userId => this.connectedUsers.get(userId))
          .filter(Boolean);

        const remainingUsersList = remainingUsers.map(u => ({ id: u!.id, nickname: u!.nickname }));
        this.server.to(roomId).emit('user_left', {
          user: { id: user.id, nickname: user.nickname },
          users: remainingUsersList,
        });

      }

      if (roomUsersSet.size === 0) {
        this.roomUsers.delete(roomId);
      }
    }
  }
}
