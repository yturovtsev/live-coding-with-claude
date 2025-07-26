/**
 * Интеграционные тесты многопользовательской синхронизации курсоров
 */

import {
  transformMultipleCursors,
  calculateTextOperation,
  transformCursorPosition,
  TextOperation
} from './cursorTransform';

describe('Multi-user cursor synchronization integration tests', () => {

  // Функция для симуляции изменений пользователя и получения обновлений другими пользователями
  const simulateUserChange = (
    oldText: string,
    newText: string,
    editingUserId: string,
    allUsers: Array<{ userId: string; position: number; nickname: string }>
  ): {
    operation: TextOperation | null;
    updatedCursors: Array<{ userId: string; position: number; nickname: string; wasUnchanged?: boolean }>;
  } => {
    // Вычисляем операцию, выполненную редактирующим пользователем
    const operation = calculateTextOperation(oldText, newText, 0);

    if (!operation) {
      return {
        operation: null,
        updatedCursors: allUsers
      };
    }

    // Трансформируем позиции курсоров всех остальных пользователей
    const otherUsers = allUsers.filter(user => user.userId !== editingUserId);
    const transformedCursors = transformMultipleCursors(
      otherUsers.map(user => ({ userId: user.userId, position: user.position })),
      operation,
      oldText,
      newText
    );

    // Объединяем с редактирующим пользователем (его курсор не требует трансформации для собственных изменений)
    const editingUser = allUsers.find(user => user.userId === editingUserId);
    const updatedCursors = [
      ...(editingUser ? [editingUser] : []),
      ...transformedCursors.map(tc => {
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
      updatedCursors
    };
  };

  describe('User Left editing, User Right observing', () => {

    test('User Left types at beginning - User Right cursor moves forward', () => {
      const initialText = 'function test() {\n  return true;\n}';
      const userLeft = { userId: 'left', position: 0, nickname: 'User Left' };
      const userRight = { userId: 'right', position: 20, nickname: 'User Right' };

      const newText = 'export function test() {\n  return true;\n}';

      const result = simulateUserChange(initialText, newText, 'left', [userLeft, userRight]);

      expect(result.operation).toEqual({
        type: 'insert',
        position: 0,
        length: 7,
        content: 'export '
      });

      const userRightAfter = result.updatedCursors.find(u => u.userId === 'right');
      expect(userRightAfter?.position).toBe(27);
      expect(userRightAfter?.wasUnchanged).toBe(false);

      const userLeftAfter = result.updatedCursors.find(u => u.userId === 'left');
      expect(userLeftAfter?.position).toBe(0);
    });

    test('User Left types after User Right cursor - User Right cursor unchanged', () => {
      const initialText = 'function test() {\n  return true;\n}';
      const userLeft = { userId: 'left', position: 25, nickname: 'User Left' };
      const userRight = { userId: 'right', position: 15, nickname: 'User Right' };

      const newText = 'function test() {\n  return true;\n};';

      const result = simulateUserChange(initialText, newText, 'left', [userLeft, userRight]);

      expect(result.operation).toEqual({
        type: 'insert',
        position: 34,
        length: 1,
        content: ';'
      });

      const userRightAfter = result.updatedCursors.find(u => u.userId === 'right');
      expect(userRightAfter?.position).toBe(15);
      expect(userRightAfter?.wasUnchanged).toBe(true);
    });

    test('User Left types before User Right cursor on same line', () => {
      const initialText = 'const message = "hello world";';
      const userLeft = { userId: 'left', position: 8, nickname: 'User Left' };
      const userRight = { userId: 'right', position: 17, nickname: 'User Right' };

      const newText = 'const message var = "hello world";';

      const result = simulateUserChange(initialText, newText, 'left', [userLeft, userRight]);

      expect(result.operation).toEqual({
        type: 'insert',
        position: 14,
        length: 4,
        content: 'var '
      });

      const userRightAfter = result.updatedCursors.find(u => u.userId === 'right');
      expect(userRightAfter?.position).toBe(21);
      expect(userRightAfter?.wasUnchanged).toBe(false);
    });

    test('User Left deletes text before User Right cursor', () => {
      const initialText = 'const unnecessary_var = "hello world";';
      const userLeft = { userId: 'left', position: 6, nickname: 'User Left' };
      const userRight = { userId: 'right', position: 30, nickname: 'User Right' };

      const newText = 'const var = "hello world";';

      const result = simulateUserChange(initialText, newText, 'left', [userLeft, userRight]);

      expect(result.operation).toEqual({
        type: 'delete',
        position: 6,
        length: 12
      });

      const userRightAfter = result.updatedCursors.find(u => u.userId === 'right');
      expect(userRightAfter?.position).toBe(18);
      expect(userRightAfter?.wasUnchanged).toBe(false);
    });

    test('User Left deletes text that includes User Right cursor position', () => {
      const initialText = 'function deleteThisFunction() { return true; }';
      const userLeft = { userId: 'left', position: 9, nickname: 'User Left' };
      const userRight = { userId: 'right', position: 20, nickname: 'User Right' };

      const newText = 'function () { return true; }';

      const result = simulateUserChange(initialText, newText, 'left', [userLeft, userRight]);

      expect(result.operation).toEqual({
        type: 'delete',
        position: 9,
        length: 18
      });

      const userRightAfter = result.updatedCursors.find(u => u.userId === 'right');
      expect(userRightAfter?.position).toBe(9);
      expect(userRightAfter?.wasUnchanged).toBe(false);
    });

    test('User Left adds new line above User Right cursor', () => {
      const initialText = 'line1\nline2\nline3';
      const userLeft = { userId: 'left', position: 5, nickname: 'User Left' };
      const userRight = { userId: 'right', position: 8, nickname: 'User Right' };

      const newText = 'line1\n\nline2\nline3';

      const result = simulateUserChange(initialText, newText, 'left', [userLeft, userRight]);

      expect(result.operation).toEqual({
        type: 'insert',
        position: 6,
        length: 1,
        content: '\n'
      });

      const userRightAfter = result.updatedCursors.find(u => u.userId === 'right');
      expect(userRightAfter?.position).toBe(9);
      expect(userRightAfter?.wasUnchanged).toBe(false);
    });

    test('User Left removes entire line above User Right cursor', () => {
      const initialText = 'line1\nline2\nline3\nline4';
      const userLeft = { userId: 'left', position: 0, nickname: 'User Left' };
      const userRight = { userId: 'right', position: 15, nickname: 'User Right' };

      const newText = 'line2\nline3\nline4';

      const result = simulateUserChange(initialText, newText, 'left', [userLeft, userRight]);

      expect(result.operation).toEqual({
        type: 'delete',
        position: 4,
        length: 6
      });

      const userRightAfter = result.updatedCursors.find(u => u.userId === 'right');
      expect(userRightAfter?.position).toBe(9);
      expect(userRightAfter?.wasUnchanged).toBe(false);
    });
  });

  describe('Multiple users editing simultaneously', () => {

    test('Three users with different cursor positions - one user edits', () => {
      const initialText = 'function calculate(a, b) {\n  return a + b;\n}';
      const userLeft = { userId: 'left', position: 9, nickname: 'User Left' };
      const userRight = { userId: 'right', position: 35, nickname: 'User Right' };
      const userCenter = { userId: 'center', position: 20, nickname: 'User Center' };

      const newText = 'async function calculate(a, b) {\n  return a + b;\n}';

      const result = simulateUserChange(initialText, newText, 'left', [userLeft, userRight, userCenter]);

      expect(result.operation).toEqual({
        type: 'insert',
        position: 0,
        length: 6,
        content: 'async '
      });

      const userRightAfter = result.updatedCursors.find(u => u.userId === 'right');
      expect(userRightAfter?.position).toBe(41);

      const userCenterAfter = result.updatedCursors.find(u => u.userId === 'center');
      expect(userCenterAfter?.position).toBe(26);

      const userLeftAfter = result.updatedCursors.find(u => u.userId === 'left');
      expect(userLeftAfter?.position).toBe(9);
    });

    test('User edits in middle - cursors before and after react differently', () => {
      const initialText = 'prefix MIDDLE suffix';
      const userBefore = { userId: 'before', position: 3, nickname: 'User Before' };
      const userEditor = { userId: 'editor', position: 7, nickname: 'User Editor' };
      const userAfter = { userId: 'after', position: 17, nickname: 'User After' };

      const newText = 'prefix replacement suffix';

      const result = simulateUserChange(initialText, newText, 'editor', [userBefore, userEditor, userAfter]);

      expect(result.operation).toEqual({
        type: 'insert',
        position: 7,
        length: 5,
        content: 'replacement'
      });

      const userBeforeAfter = result.updatedCursors.find(u => u.userId === 'before');
      expect(userBeforeAfter?.position).toBe(3);
      expect(userBeforeAfter?.wasUnchanged).toBe(true);

      const userAfterAfter = result.updatedCursors.find(u => u.userId === 'after');
      expect(userAfterAfter?.position).toBe(25);
      expect(userAfterAfter?.wasUnchanged).toBe(false);

      const userEditorAfter = result.updatedCursors.find(u => u.userId === 'editor');
      expect(userEditorAfter?.position).toBe(7);
    });
  });

  describe('Complex real-world scenarios', () => {

    test('Code refactoring - function rename with parameters', () => {
      const initialText = 'function oldFunctionName(param1, param2) {\n  console.log("Hello");\n  return param1 + param2;\n}';
      const userLeft = { userId: 'left', position: 9, nickname: 'User Left' };
      const userRight = { userId: 'right', position: 70, nickname: 'User Right' };

      const newText = 'function newBetterFunctionName(param1, param2) {\n  console.log("Hello");\n  return param1 + param2;\n}';

      const result = simulateUserChange(initialText, newText, 'left', [userLeft, userRight]);

      expect(result.operation).toEqual({
        type: 'insert',
        position: 9,
        length: 6,
        content: 'newBetter'
      });

      const userRightAfter = result.updatedCursors.find(u => u.userId === 'right');
      expect(userRightAfter?.position).toBe(76);
      expect(userRightAfter?.wasUnchanged).toBe(false);
    });

    test('Adding imports at top - all cursors below move down', () => {
      const initialText = 'function main() {\n  console.log("Starting...");\n  process();\n}';
      const userLeft = { userId: 'left', position: 0, nickname: 'User Left' };
      const userRight = { userId: 'right', position: 25, nickname: 'User Right' };
      const userCenter = { userId: 'center', position: 45, nickname: 'User Center' };

      const newText = 'import { process } from "./utils";\nimport fs from "fs";\n\nfunction main() {\n  console.log("Starting...");\n  process();\n}';

      const result = simulateUserChange(initialText, newText, 'left', [userLeft, userRight, userCenter]);

      expect(result.operation).toEqual({
        type: 'insert',
        position: 0,
        length: 57,
        content: 'import { process } from "./utils";\nimport fs from "fs";\n\n'
      });

      const userRightAfter = result.updatedCursors.find(u => u.userId === 'right');
      expect(userRightAfter?.position).toBe(82);

      const userCenterAfter = result.updatedCursors.find(u => u.userId === 'center');
      expect(userCenterAfter?.position).toBe(102);
    });

    test('Deleting a block of code - cursors within and after are affected', () => {
      const initialText = 'function test() {\n  // This is temporary code\n  console.log("debug");\n  const temp = 42;\n  // End temporary\n  return true;\n}';
      const userLeft = { userId: 'left', position: 20, nickname: 'User Left' };
      const userRight = { userId: 'right', position: 80, nickname: 'User Right' };
      const userAfter = { userId: 'after', position: 120, nickname: 'User After' };

      const newText = 'function test() {\n  return true;\n}';

      const result = simulateUserChange(initialText, newText, 'left', [userLeft, userRight, userAfter]);

      const deletedText = '// This is temporary code\n  console.log("debug");\n  const temp = 42;\n  // End temporary\n  ';
      expect(result.operation).toEqual({
        type: 'delete',
        position: 20,
        length: deletedText.length
      });

      const userRightAfter = result.updatedCursors.find(u => u.userId === 'right');
      expect(userRightAfter?.position).toBe(20);
      expect(userRightAfter?.wasUnchanged).toBe(false);

      const userAfterAfter = result.updatedCursors.find(u => u.userId === 'after');
      expect(userAfterAfter?.position).toBe(20);
      expect(userAfterAfter?.wasUnchanged).toBe(false);
    });
  });

  describe('Edge cases and cursor stability', () => {

    test('User Right cursor at exact position where User Left inserts', () => {
      const initialText = 'hello world';
      const userLeft = { userId: 'left', position: 5, nickname: 'User Left' };
      const userRight = { userId: 'right', position: 5, nickname: 'User Right' };

      const newText = 'hello, world';

      const result = simulateUserChange(initialText, newText, 'left', [userLeft, userRight]);

      expect(result.operation).toEqual({
        type: 'insert',
        position: 5,
        length: 1,
        content: ','
      });

      const userRightAfter = result.updatedCursors.find(u => u.userId === 'right');
      expect(userRightAfter?.position).toBe(6);
      expect(userRightAfter?.wasUnchanged).toBe(false);
    });

    test('Multiple rapid changes preserve cursor relationships', () => {
      let currentText = 'line1\nline2\nline3';
      const userLeft = { userId: 'left', position: 0, nickname: 'User Left' };
      let userRight = { userId: 'right', position: 8, nickname: 'User Right' };

      let newText = '// line1\nline2\nline3';
      let result = simulateUserChange(currentText, newText, 'left', [userLeft, userRight]);

      let userRightAfter = result.updatedCursors.find(u => u.userId === 'right');
      expect(userRightAfter?.position).toBe(11);

      currentText = newText;
      userRight = { ...userRight, position: userRightAfter?.position || 8 };

      userLeft.position = 9;
      newText = '// line1\n// line2\nline3';
      result = simulateUserChange(currentText, newText, 'left', [userLeft, userRight]);

      userRightAfter = result.updatedCursors.find(u => u.userId === 'right');
      expect(userRightAfter?.position).toBe(14);

      const line2Start = newText.indexOf('// line2');
      const relativePos = (userRightAfter?.position || 0) - line2Start;
      expect(relativePos).toBe(5);
    });

    test('User cursors preserved during no-op changes', () => {
      const initialText = 'unchanged text';
      const userLeft = { userId: 'left', position: 5, nickname: 'User Left' };
      const userRight = { userId: 'right', position: 10, nickname: 'User Right' };

      const newText = 'unchanged text';

      const result = simulateUserChange(initialText, newText, 'left', [userLeft, userRight]);

      expect(result.operation).toBeNull();

      expect(result.updatedCursors).toEqual([userLeft, userRight]);
    });
  });
});
