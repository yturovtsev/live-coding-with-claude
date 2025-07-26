export interface CodeFile {
  id: string;
  code: string;
  language: string;
  createdAt: string;
}

export interface User {
  id: string;
  nickname: string;
  cursorPosition?: number;
  preserveVisual?: boolean;
}

export interface ServerCursor {
  userId: string;
  position: number;
  nickname?: string;
}

export interface CodeState {
  currentFile: CodeFile | null;
  isConnected: boolean;
  isInRoom: boolean;
  users: User[];
  currentUserId: string | null;
  isLoading: boolean;
  error: string | null;
  previousCode: string;
}

export interface SocketEvents {
  join_room: (data: { roomId: string; nickname?: string }) => void;
  leave_room: () => void;
  code_update: (data: { roomId: string; code: string; language?: string }) => void;
  language_change: (data: { roomId: string; language: string }) => void;
  cursor_update: (data: { roomId: string; position: number }) => void;
}