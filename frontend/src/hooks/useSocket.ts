import { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from './redux';
import { io, Socket } from 'socket.io-client';
import { setConnected, setInRoom, setUsers, setCurrentUserId, updateUserCursor, updateCode, updateLanguage, setError } from '../store/codeSlice';
import { User, ServerCursor } from '../types';
import { calculateTextOperation } from '../utils/cursorTransform';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001';

// Глобальный socket instance
let globalSocket: Socket | null = null;
let globalDispatch: any = null;
let globalState: any = null;

export const useSocket = () => {
  const dispatch = useAppDispatch();
  const state = useAppSelector(state => state.code);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    // Обновляем dispatch и state для текущего компонента
    globalDispatch = dispatch;
    globalState = state;

    // Используем глобальный socket instance
    if (!globalSocket && !isInitializedRef.current) {
      globalSocket = io(`${SOCKET_URL}/ws`, {
        transports: ['websocket'],
        upgrade: false
      });
      isInitializedRef.current = true;

      // Устанавливаем обработчики событий только один раз
      setupSocketHandlers();
    }

    return () => {
      // Отключаем socket только при размонтировании последнего компонента
    };
  }, [dispatch, state]);

  const setupSocketHandlers = () => {
    const socket = globalSocket;
    if (!socket) return;

    socket.on('connect', () => {
      globalDispatch(setConnected(true));
      if (socket.id) {
        globalDispatch(setCurrentUserId(socket.id));
      }
    });

    socket.on('disconnect', () => {
      globalDispatch(setConnected(false));
      globalDispatch(setInRoom(false));
    });

    socket.on('joined_room', (data: { roomId: string; code: string; language: string }) => {
      console.log('✅ Successfully joined room:', data.roomId, 'with code length:', data.code.length);
      globalDispatch(updateCode({ code: data.code, language: data.language }));
      globalDispatch(setInRoom(true));
    });

    socket.on('user_joined', (data: { user: User; users: User[] }) => {
      globalDispatch(setUsers(data.users));
    });

    socket.on('user_left', (data: { user: User; users: User[] }) => {
      globalDispatch(setUsers(data.users));
    });

    socket.on('code_updated', (data: { 
      code: string; 
      language?: string; 
      userId: string; 
      userNickname: string;
      oldCode?: string;
      allCursors?: ServerCursor[];
    }) => {
      console.log('📨 Received code_updated event from user:', data.userNickname);
      console.log('📨 New code length:', data.code.length);
      console.log('📨 Old code provided:', !!data.oldCode, 'length:', data.oldCode?.length);
      console.log('📨 All cursors received:', data.allCursors);
      console.log('📨 Full data object:', data);
      
      // Use provided old code or fallback to current state
      const serverOldCode = data.oldCode || '';
      const clientOldCode = globalState?.currentFile?.code || '';
      const previousCode = serverOldCode || clientOldCode;
      
      console.log('🔍 Code comparison:');
      console.log('Server old code length:', serverOldCode.length);
      console.log('Client old code length:', clientOldCode.length);
      console.log('Using code length:', previousCode.length);
      
      const operation = calculateTextOperation(previousCode, data.code, 0);
      console.log('🔍 Calculated operation:', operation);
      
      globalDispatch(updateCode({
        code: data.code,
        language: data.language,
        fromOtherUser: true,
        operation: operation || undefined,
        serverCursors: data.allCursors
      }));
    });

    socket.on('language_changed', (data: { language: string; userId: string; userNickname: string }) => {
      globalDispatch(updateLanguage(data.language));
    });

    socket.on('cursor_updated', (data: { userId: string; position: number; userNickname: string }) => {
      console.log(`Received cursor_updated:`, data);
      globalDispatch(updateUserCursor({ userId: data.userId, position: data.position }));
    });

    socket.on('error', (data: { message: string }) => {
      console.error('Socket error:', data.message);
      // Не показываем ошибку "Not in room" пользователю, так как это может быть временная проблема
      if (data.message !== 'Not in room') {
        globalDispatch(setError(data.message));
      }
    });
  };

  const joinRoom = (roomId: string, nickname?: string) => {
    console.log('🚀 Attempting to join room:', roomId, 'with nickname:', nickname);
    globalSocket?.emit('join_room', { roomId, nickname });
  };

  const leaveRoom = () => {
    console.log('🚪 Leaving room');
    globalSocket?.emit('leave_room');
  };

  const sendCodeUpdate = (roomId: string, code: string, language?: string) => {
    globalSocket?.emit('code_update', { roomId, code, language });
  };

  const sendLanguageChange = (roomId: string, language: string) => {
    globalSocket?.emit('language_change', { roomId, language });
  };

  const sendCursorUpdate = (roomId: string, position: number) => {
    console.log(`Emitting cursor_update: roomId=${roomId}, position=${position}, socket connected=${globalSocket?.connected}`);
    globalSocket?.emit('cursor_update', { roomId, position });
  };

  return {
    joinRoom,
    leaveRoom,
    sendCodeUpdate,
    sendLanguageChange,
    sendCursorUpdate,
  };
};
