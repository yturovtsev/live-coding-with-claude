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
    origin: process.env.NODE_ENV === 'production' ?
      ['http://localhost', 'http://localhost:80'] :
      ['http://localhost:3001', 'http://localhost', 'http://localhost:80'],
    credentials: true,
    methods: ['GET', 'POST'],
  },
})
export class CodeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedUsers = new Map<string, ConnectedUser>();
  private roomUsers = new Map<string, Set<string>>();

  constructor(private codeService: CodeService) {}

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}. Total connected users: ${this.connectedUsers.size}`);
    
    // Логирование всех входящих событий для отладки
    client.onAny((eventName, ...args) => {
      console.log(`Received event: ${eventName}`, args);
    });
  }

  handleDisconnect(client: Socket) {
    const user = this.connectedUsers.get(client.id);
    console.log(`Client disconnecting: ${client.id}, user exists: ${!!user}`);
    if (user) {
      console.log(`User ${user.nickname} in room ${user.roomId} is disconnecting`);
      this.leaveRoom(client, user.roomId);
      this.connectedUsers.delete(client.id);
    }
    console.log(`Client disconnected: ${client.id}. Remaining connected users: ${this.connectedUsers.size}`);
  }

  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; nickname?: string },
  ) {
    const { roomId, nickname } = data;
    console.log(`Processing join_room request: user ${client.id}, room ${roomId}, nickname ${nickname}`);

    const codeFile = await this.codeService.getCodeFile(roomId);
    if (!codeFile) {
      console.log(`Room not found: ${roomId}`);
      client.emit('error', { message: 'Room not found' });
      return;
    }

    if (new Date() > codeFile.expiresAt) {
      console.log(`Room expired: ${roomId}`);
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

    // Отправляем обновленный список пользователей всем в комнате (включая нового пользователя)
    const currentUsers = roomUsersList.map(u => ({ id: u!.id, nickname: u!.nickname }));
    this.server.to(roomId).emit('user_joined', {
      user: { id: user.id, nickname: user.nickname },
      users: currentUsers,
    });

    // Также отправляем новому пользователю текущий список пользователей
    client.emit('user_joined', {
      user: { id: user.id, nickname: user.nickname },
      users: currentUsers,
    });

    console.log(`User ${user.nickname} joined room ${roomId}. Total users: ${currentUsers.length}`,
                `Users: ${currentUsers.map(u => u.nickname).join(', ')}`);
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
    const { roomId, code, language } = data;
    console.log(`=== CODE UPDATE DEBUG ===`);
    console.log(`Client ID: ${client.id}`);
    console.log(`Room ID: ${roomId}`);
    console.log(`Total connected users: ${this.connectedUsers.size}`);
    console.log(`All connected user IDs:`, Array.from(this.connectedUsers.keys()));
    
    const user = this.connectedUsers.get(client.id);
    console.log(`User found for ${client.id}:`, user ? `${user.nickname} in room ${user.roomId}` : 'undefined');

    if (!user || user.roomId !== roomId) {
      console.error('handleCodeUpdate ERROR', { 
        user, 
        clientId: client.id,
        requestedRoom: roomId,
        userRoom: user?.roomId,
        totalUsers: this.connectedUsers.size
      });
      client.emit('error', { message: 'Not in room' });
      return;
    }

    try {
      // Get current code before update for cursor transformation
      const oldCodeFile = await this.codeService.getCodeFile(roomId);
      const oldCode = oldCodeFile?.code || '';
      
      await this.codeService.updateCodeFile(roomId, code, language);
      console.log(`Code updated in room ${roomId} by user ${user.nickname}`);

      // Get all users in the room with their cursor positions
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

      console.log(`Sending code update with cursors:`, allCursors);

      // Отправляем обновление всем ДРУГИМ пользователям в комнате (не тому, кто отправил)
      client.to(roomId).emit('code_updated', {
        code,
        language,
        userId: client.id,
        userNickname: user.nickname,
        oldCode, // Add old code for transformation
        allCursors // Add all cursor positions
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
    console.log(`=== CURSOR UPDATE DEBUG ===`);
    console.log(`Client ID: ${client.id}`);
    console.log(`Room ID: ${roomId}`);
    console.log(`Position: ${position}`);
    
    const user = this.connectedUsers.get(client.id);
    console.log(`User found:`, user ? `${user.nickname} in room ${user.roomId}` : 'undefined');

    if (!user || user.roomId !== roomId) {
      console.log(`Cursor update failed: User not in room`);
      client.emit('error', { message: 'Not in room' });
      return;
    }

    // Update user's cursor position on server
    user.cursorPosition = position;
    
    console.log(`Sending cursor update to room ${roomId} from user ${user.nickname}`);
    // Отправляем обновление позиции курсора всем ДРУГИМ пользователям в комнате
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

        console.log(`User ${user.nickname} left room ${roomId}. Remaining users: ${remainingUsersList.length}`,
                    `Users: ${remainingUsersList.map(u => u.nickname).join(', ')}`);
      }

      if (roomUsersSet.size === 0) {
        this.roomUsers.delete(roomId);
      }
    }
  }
}
