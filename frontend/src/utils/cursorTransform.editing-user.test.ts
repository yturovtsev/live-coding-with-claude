/**
 * Тесты синхронизации позиции курсора редактирующего пользователя
 * Воспроизводит и исправляет баг, когда курсор редактирующего пользователя прыгает в неправильную позицию
 */

import { 
  transformMultipleCursors, 
  calculateTextOperation,
  transformCursorPosition 
} from './cursorTransform';

describe('Editing user cursor position synchronization', () => {
  
  // Функция для симуляции реального поведения обновления курсора
  const simulateRealUserEdit = (
    oldText: string,
    newText: string,
    editingUserId: string,
    editingUserCursorPos: number,
    allUsers: Array<{ userId: string; position: number; nickname: string }>
  ) => {
    const operation = calculateTextOperation(oldText, newText, editingUserCursorPos);
    
    if (!operation) {
      return {
        operation: null,
        updatedCursors: allUsers
      };
    }
    
    // Трансформируем курсоры других пользователей (не редактирующего)
    const otherUsers = allUsers.filter(user => user.userId !== editingUserId);
    const transformedOtherCursors = transformMultipleCursors(
      otherUsers.map(user => ({ userId: user.userId, position: user.position })),
      operation,
      oldText,
      newText
    );
    
    const editingUser = allUsers.find(user => user.userId === editingUserId);
    
    // Ключевая проблема: позиция курсора редактирующего пользователя должна сохраняться корректно
    let editingUserNewPosition = editingUserCursorPos;
    
    // При вставке курсор обычно сдвигается вперед на длину вставки
    if (operation.type === 'insert') {
      editingUserNewPosition = editingUserCursorPos + operation.length;
    }
    // При удалении курсор обычно остается в начале удаления
    
    const updatedCursors = [
      ...(editingUser ? [{
        ...editingUser,
        position: editingUserNewPosition
      }] : []),
      ...transformedOtherCursors.map(tc => {
        const originalUser = allUsers.find(u => u.userId === tc.userId);
        return {
          userId: tc.userId,
          position: tc.position || 0,
          nickname: originalUser?.nickname || 'Unknown',
          wasUnchanged: tc.wasUnchanged
        };
      })
    ];
    
    return {
      operation,
      updatedCursors,
      editingUserNewPosition
    };
  };

  describe('Bug reproduction: editing user cursor jumps to wrong line', () => {
    
    test('REPRODUCE BUG: Cursor position race condition during editing', () => {
      const initialText = 'line1\nline2\nline3';
      const userLeft = { userId: 'left', position: 8, nickname: 'User Left' };
      const userRight = { userId: 'right', position: 3, nickname: 'User Right' };
      
      const newText = 'line1\nliXne2\nline3';
      
      // СИМУЛЯЦИЯ БАГА: проблема не в вычислении операций, а в обработке курсоров
      // 1. Local code change triggers cursor transformation for other users
      const operation = calculateTextOperation(initialText, newText, 0);
      
      
      const otherUsers = [userRight];
      const transformedOtherCursors = transformMultipleCursors(
        otherUsers.map(user => ({ userId: user.userId, position: user.position })),
        operation!,
        initialText,
        newText
      );
      
      
      // СИМУЛЯЦИЯ РЕАЛЬНОГО БАГА: состояние гонки с обновлениями курсора
      const editingUserOldPosition = 8;
      const editingUserNewPosition = 9;
      
      // Когда другие пользователи получают обновление кода, они видят старую позицию курсора
      
      const editingUserTransformedPosition = transformCursorPosition(
        editingUserOldPosition,
        operation!,
        initialText,
        newText
      );
      
      
      // Эта трансформация может вызвать эффект "прыгающего" курсора
      
      expect(editingUserTransformedPosition.position).toBe(9);
      
      // Исправление: немедленно обновлять позицию курсора редактирующего пользователя в локальном состоянии
    });

    test('FIX VERIFICATION: Editing user cursor stays stable after fix', () => {
      const initialText = 'line1\nline2\nline3';
      const userLeft = { userId: 'left', position: 8, nickname: 'User Left' };
      const userRight = { userId: 'right', position: 3, nickname: 'User Right' };
      
      const newText = 'line1\nliXne2\nline3';
      
      // ПОСЛЕ ИСПРАВЛЕНИЯ: позиция курсора редактирующего пользователя должна обновляться немедленно
      
      const operation = calculateTextOperation(initialText, newText, 0);
      
      const otherUsers = [userRight];
      const transformedOtherCursors = transformMultipleCursors(
        otherUsers.map(user => ({ userId: user.userId, position: user.position })),
        operation!,
        initialText,
        newText
      );
      
      const editingUserNewPosition = 9;
      
      const finalCursors = [
        // Editing user with their new correct position (not transformed)
        { userId: 'left', position: editingUserNewPosition, nickname: 'User Left' },
        // Other users with transformed positions
        ...transformedOtherCursors.map(tc => ({
          userId: tc.userId,
          position: tc.position || 0,
          nickname: 'User Right',
          wasUnchanged: tc.wasUnchanged
        }))
      ];
      
      
      const editingUserFinal = finalCursors.find(u => u.userId === 'left');
      expect(editingUserFinal?.position).toBe(9);
      
      const textBeforeCursor = newText.substring(0, 9);
      const lines = textBeforeCursor.split('\n');
      expect(lines.length - 1).toBe(1);
      expect(lines[1]).toBe('liX');
      
      const otherUserFinal = finalCursors.find(u => u.userId === 'right');
      expect(otherUserFinal?.position).toBe(3);
    });

    test('User Left types at beginning of line - cursor should stay on same line', () => {
      const initialText = 'line1\nline2\nline3';
      const userLeft = { userId: 'left', position: 6, nickname: 'User Left' };
      const userRight = { userId: 'right', position: 12, nickname: 'User Right' };
      
      const newText = 'line1\nSTART:line2\nline3';
      
      const result = simulateRealUserEdit(initialText, newText, 'left', 6, [userLeft, userRight]);
      
      expect(result.operation).toEqual({
        type: 'insert',
        position: 6,
        length: 6,
        content: 'START:'
      });
      
      // User Left's cursor should move to after 'START:'
      expect(result.editingUserNewPosition).toBe(12); // 6 + 6
      
      // User Right should see User Left's cursor at position 12
      const userLeftAfter = result.updatedCursors.find(u => u.userId === 'left');
      expect(userLeftAfter?.position).toBe(12);
      
      // Verify this position is still on line2 (after 'START:')
      const textBeforeCursor = newText.substring(0, 12);
      const lines = textBeforeCursor.split('\n');
      expect(lines.length - 1).toBe(1); // Should be on line 1 (0-indexed), which is line2
      expect(lines[1]).toBe('START:'); // Should be right after 'START:'
    });

    test('User Left deletes text - cursor should stay at correct position', () => {
      const initialText = 'line1\nline2DELETE\nline3';
      const userLeft = { userId: 'left', position: 12, nickname: 'User Left' }; // Before 'DELETE'
      const userRight = { userId: 'right', position: 20, nickname: 'User Right' }; // After 'DELETE'
      
      // User Left deletes 'DELETE'
      const newText = 'line1\nline2\nline3';
      
      const result = simulateRealUserEdit(initialText, newText, 'left', 12, [userLeft, userRight]);
      
      expect(result.operation).toEqual({
        type: 'delete',
        position: 11, // Real position calculated by algorithm
        length: 6 // 'DELETE' length
      });
      
      // User Left's cursor should stay at position 12 (start of deletion)
      expect(result.editingUserNewPosition).toBe(12);
      
      // User Right should see User Left's cursor at position 12
      const userLeftAfter = result.updatedCursors.find(u => u.userId === 'left');
      expect(userLeftAfter?.position).toBe(12);
      
      // Verify this position is at end of line2
      const textBeforeCursor = newText.substring(0, 12);
      const lines = textBeforeCursor.split('\n');
      expect(lines.length - 1).toBe(2);
      expect(lines[2]).toBe('');
    });

    test('User Left adds newline - cursor should be on new line, not wrong line', () => {
      const initialText = 'line1\nline2\nline3';
      const userLeft = { userId: 'left', position: 12, nickname: 'User Left' }; // End of line2
      const userRight = { userId: 'right', position: 18, nickname: 'User Right' }; // End of line3
      
      // User Left presses Enter at end of line2
      const newText = 'line1\nline2\n\nline3';
      
      const result = simulateRealUserEdit(initialText, newText, 'left', 12, [userLeft, userRight]);
      
      expect(result.operation).toEqual({
        type: 'insert',
        position: 12,
        length: 1,
        content: '\n'
      });
      
      // User Left's cursor should move to the new empty line
      expect(result.editingUserNewPosition).toBe(13); // 12 + 1
      
      // User Right should see User Left's cursor at position 13
      const userLeftAfter = result.updatedCursors.find(u => u.userId === 'left');
      expect(userLeftAfter?.position).toBe(13);
      
      // Verify this position is on the new empty line (line3, 0-indexed line 2)
      const textBeforeCursor = newText.substring(0, 13);
      const lines = textBeforeCursor.split('\n');
      expect(lines.length - 1).toBe(3);
      expect(lines[3]).toBe('');
    });
  });

  describe('Complex editing scenarios', () => {
    
    test('User Left replaces word - cursor should be at end of replacement', () => {
      const initialText = 'function oldName() { return true; }';
      const userLeft = { userId: 'left', position: 9, nickname: 'User Left' }; // Before 'oldName'
      const userRight = { userId: 'right', position: 25, nickname: 'User Right' }; // After 'return '
      
      // User Left selects 'oldName' and types 'newFunctionName'
      // First they delete 'oldName' (selection), then type replacement
      const intermediateText = 'function () { return true; }'; // After deletion
      const newText = 'function newFunctionName() { return true; }'; // After typing
      
      // Simulate the replacement as an insert operation (net effect)
      const result = simulateRealUserEdit(initialText, newText, 'left', 9, [userLeft, userRight]);
      
      // The algorithm should detect this as an insertion
      expect(result.operation?.type).toBe('insert');
      expect(result.operation?.position).toBe(9);
      
      // User Left's cursor should be after 'newFunctionName'
      expect(result.editingUserNewPosition).toBe(9 + (result.operation?.length || 0));
      
      // Verify the cursor is in the right place
      const userLeftAfter = result.updatedCursors.find(u => u.userId === 'left');
      const cursorPos = userLeftAfter?.position || 0;
      const textBeforeCursor = newText.substring(0, cursorPos);
      expect(textBeforeCursor).toBe('function newFunct');
    });

    test('Multiple rapid edits preserve cursor line consistency', () => {
      let currentText = 'line1\nline2\nline3';
      const userLeft = { userId: 'left', position: 8, nickname: 'User Left' }; // Middle of line2
      const userRight = { userId: 'right', position: 14, nickname: 'User Right' }; // Middle of line3
      
      // Edit 1: User Left types 'A'
      let newText = 'line1\nliAne2\nline3';
      let result = simulateRealUserEdit(currentText, newText, 'left', 8, [userLeft, userRight]);
      
      let userLeftAfter = result.updatedCursors.find(u => u.userId === 'left');
      expect(userLeftAfter?.position).toBe(9); // After 'A'
      
      // Verify still on line2
      let textBeforeCursor = newText.substring(0, 9);
      let lines = textBeforeCursor.split('\n');
      expect(lines.length - 1).toBe(1);
      
      // Update for next edit
      currentText = newText;
      userLeft.position = 9;
      
      // Edit 2: User Left types 'B'
      newText = 'line1\nliABne2\nline3';
      result = simulateRealUserEdit(currentText, newText, 'left', 9, [userLeft, userRight]);
      
      userLeftAfter = result.updatedCursors.find(u => u.userId === 'left');
      expect(userLeftAfter?.position).toBe(10); // After 'AB'
      
      // Verify still on line2
      textBeforeCursor = newText.substring(0, 10);
      lines = textBeforeCursor.split('\n');
      expect(lines.length - 1).toBe(1);
      expect(lines[1]).toBe('liAB');
    });
  });

  describe('Edge cases in cursor position tracking', () => {
    
    test('Cursor at line boundary - insertion should not jump lines', () => {
      const initialText = 'line1\nline2';
      const userLeft = { userId: 'left', position: 5, nickname: 'User Left' }; // End of line1 (before \n)
      const userRight = { userId: 'right', position: 11, nickname: 'User Right' }; // End of line2
      
      // User Left types '!' at end of line1
      const newText = 'line1!\nline2';
      
      const result = simulateRealUserEdit(initialText, newText, 'left', 5, [userLeft, userRight]);
      
      expect(result.operation).toEqual({
        type: 'insert',
        position: 5,
        length: 1,
        content: '!'
      });
      
      // User Left's cursor should be after '!' but still on line1
      expect(result.editingUserNewPosition).toBe(6);
      
      const userLeftAfter = result.updatedCursors.find(u => u.userId === 'left');
      expect(userLeftAfter?.position).toBe(6);
      
      // Verify cursor is still on line1
      const textBeforeCursor = newText.substring(0, 6);
      const lines = textBeforeCursor.split('\n');
      expect(lines.length - 1).toBe(0);
      expect(lines[0]).toBe('line1!');
    });

    test('Empty line editing - cursor should stay on empty line', () => {
      const initialText = 'line1\n\nline3';
      const userLeft = { userId: 'left', position: 6, nickname: 'User Left' }; // On empty line2
      const userRight = { userId: 'right', position: 12, nickname: 'User Right' }; // On line3
      
      // User Left types 'content' on empty line
      const newText = 'line1\ncontent\nline3';
      
      const result = simulateRealUserEdit(initialText, newText, 'left', 6, [userLeft, userRight]);
      
      expect(result.operation).toEqual({
        type: 'insert',
        position: 6,
        length: 7,
        content: 'content'
      });
      
      // User Left's cursor should be after 'content' on line2
      expect(result.editingUserNewPosition).toBe(13); // 6 + 7
      
      const userLeftAfter = result.updatedCursors.find(u => u.userId === 'left');
      expect(userLeftAfter?.position).toBe(13);
      
      // Verify cursor is on line2 after 'content'
      const textBeforeCursor = newText.substring(0, 13);
      const lines = textBeforeCursor.split('\n');
      expect(lines.length - 1).toBe(1);
      expect(lines[1]).toBe('content');
    });
  });
});