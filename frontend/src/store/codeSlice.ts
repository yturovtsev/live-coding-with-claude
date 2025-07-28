import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import { CodeFile, CodeState, User, ServerCursor } from '../types';
import { transformMultipleCursors, calculateTextOperation, TextOperation } from '../utils/cursorTransform';

console.log({'=========env========': process.env })
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

export const createCodeFile = createAsyncThunk(
  'code/createCodeFile',
  async () => {
    const response = await axios.post(`${API_BASE_URL}/api/code`);
    return response.data;
  }
);

export const getCodeFile = createAsyncThunk(
  'code/getCodeFile',
  async (id: string) => {
    const response = await axios.get(`${API_BASE_URL}/api/code/${id}`);
    return response.data;
  }
);

export const updateCodeFile = createAsyncThunk(
  'code/updateCodeFile',
  async ({ id, code, language }: { id: string; code: string; language?: string }) => {
    const response = await axios.put(`${API_BASE_URL}/api/code/${id}`, {
      code,
      language,
    });
    return response.data;
  }
);

const initialState: CodeState = {
  currentFile: null,
  isConnected: false,
  isInRoom: false,
  users: [],
  currentUserId: null,
  isLoading: false,
  error: null,
  previousCode: '', // Track previous code for text operation calculation
};

const codeSlice = createSlice({
  name: 'code',
  initialState,
  reducers: {
    setConnected: (state, action: PayloadAction<boolean>) => {
      state.isConnected = action.payload;
      if (!action.payload) {
        state.isInRoom = false;
      }
    },
    setInRoom: (state, action: PayloadAction<boolean>) => {
      state.isInRoom = action.payload;
    },
    setUsers: (state, action: PayloadAction<User[]>) => {
      state.users = action.payload;
    },
    setCurrentUserId: (state, action: PayloadAction<string>) => {
      state.currentUserId = action.payload;
    },
    updateUserCursor: (state, action: PayloadAction<{ userId: string; position: number; preserveVisual?: boolean }>) => {
      const user = state.users.find(u => u.id === action.payload.userId);
      if (user) {
        const oldPosition = user.cursorPosition;
        console.log(`📍 Direct cursor update: ${user.nickname} ${oldPosition} -> ${action.payload.position}`);
        user.cursorPosition = action.payload.position;
        // Add flag to preserve visual position if needed
        if (action.payload.preserveVisual !== undefined) {
          (user as any).preserveVisual = action.payload.preserveVisual;
        }
      }
    },
    updateCode: (state, action: PayloadAction<{
      code: string;
      language?: string;
      fromOtherUser?: boolean;
      fromLocalUser?: boolean;
      operation?: TextOperation;
      serverCursors?: ServerCursor[];
    }>) => {
      if (state.currentFile) {
        const oldCode = state.currentFile.code;

        // Update previous code BEFORE changing current code
        state.previousCode = oldCode;
        state.currentFile.code = action.payload.code;

        if (action.payload.language) {
          state.currentFile.language = action.payload.language;
        }

        // Handle cursor transformations for both local and remote changes
        if (action.payload.fromOtherUser || action.payload.fromLocalUser) {
          const isFromOtherUser = action.payload.fromOtherUser;
          const isFromLocalUser = action.payload.fromLocalUser;

          console.log(`🔄 REDUX: Processing ${isFromOtherUser ? 'remote' : 'local'} update`);

          // If server provided cursor positions, use them directly
          if (action.payload.serverCursors && action.payload.serverCursors.length > 0) {
            console.log('✅ Using server-provided cursor positions:', action.payload.serverCursors);

            // Transform all server cursors using the operation
            if (action.payload.operation) {

              const transformedCursors = transformMultipleCursors(
                action.payload.serverCursors.map(c => ({ userId: c.userId, position: c.position })),
                action.payload.operation,
                oldCode,
                action.payload.code
              );


              // Update cursor positions for all users
              transformedCursors.forEach(({ userId, position, wasUnchanged }) => {
                const user = state.users.find(u => u.id === userId);
                if (user && userId !== state.currentUserId) {
                  if (position === null) {
                    delete user.cursorPosition;
                  } else {
                    user.cursorPosition = position;
                    // Preserve visual position if cursor was logically unchanged
                    (user as any).preserveVisual = wasUnchanged;
                  }
                }
              });
            }
          } else if (action.payload.operation) {
            // Transform cursors based on the operation
            console.log('❌ No server cursors, using fallback transformation');

            // For local changes, transform only other users' cursors
            // For remote changes, transform all cursors except current user
            const cursorsToTransform = state.users
              .filter(user => {
                const hasPosition = user.cursorPosition !== undefined;
                const isCurrentUser = user.id === state.currentUserId;

                if (isFromLocalUser) {
                  // Local change: transform only other users' cursors, exclude editing user
                  return hasPosition && !isCurrentUser;
                } else {
                  // Remote change: transform all users' cursors except current user
                  return hasPosition && !isCurrentUser;
                }
              })
              .map(user => ({ userId: user.id, position: user.cursorPosition! }));

            console.log(`🔄 REDUX: Transforming ${cursorsToTransform.length} cursors for ${isFromLocalUser ? 'local' : 'remote'} change`);

            if (cursorsToTransform.length > 0) {
              const transformedCursors = transformMultipleCursors(cursorsToTransform, action.payload.operation, oldCode, action.payload.code);

              transformedCursors.forEach(({ userId, position, wasUnchanged }) => {
                const user = state.users.find(u => u.id === userId);
                if (user) {
                  const oldPosition = user.cursorPosition;
                  if (position === null) {
                    console.log(`🔄 Cursor UPDATE: ${user.nickname} ${oldPosition} -> DELETED`);
                    delete user.cursorPosition;
                  } else {
                    console.log(`🔄 Cursor UPDATE: ${user.nickname} ${oldPosition} -> ${position} ${wasUnchanged ? '(unchanged)' : '(transformed)'}`);
                    user.cursorPosition = position;
                    // Preserve visual position if cursor was logically unchanged
                    (user as any).preserveVisual = wasUnchanged;
                  }
                }
              });
            }
          }
        }
      }
    },
    updateLanguage: (state, action: PayloadAction<string>) => {
      if (state.currentFile) {
        state.currentFile.language = action.payload;
      }
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
    resetRoomState: (state) => {
      state.currentFile = null;
      state.isInRoom = false;
      state.users = [];
      state.currentUserId = null;
      state.error = null;
      state.previousCode = '';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createCodeFile.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createCodeFile.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentFile = action.payload;
      })
      .addCase(createCodeFile.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to create code file';
      })
      .addCase(getCodeFile.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getCodeFile.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentFile = action.payload;
        // Initialize previousCode when file is loaded
        state.previousCode = action.payload.code;
      })
      .addCase(getCodeFile.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to get code file';
      })
      .addCase(updateCodeFile.fulfilled, (state, action) => {
        state.currentFile = action.payload;
      });
  },
});

export const {
  setConnected,
  setInRoom,
  setUsers,
  setCurrentUserId,
  updateUserCursor,
  updateCode,
  updateLanguage,
  setError,
  clearError,
  resetRoomState,
} = codeSlice.actions;

export default codeSlice.reducer;
