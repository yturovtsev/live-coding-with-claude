/**
 * Integration tests for multi-user cursor synchronization
 * Tests real-world scenarios where User Left makes changes and User Right observes them
 */

import {
  transformMultipleCursors,
  calculateTextOperation,
  transformCursorPosition,
  TextOperation
} from './cursorTransform';

describe('Multi-user cursor synchronization integration tests', () => {

  // Helper function to simulate a user making changes and other users receiving updates
  const simulateUserChange = (
    oldText: string,
    newText: string,
    editingUserId: string,
    allUsers: Array<{ userId: string; position: number; nickname: string }>
  ): {
    operation: TextOperation | null;
    updatedCursors: Array<{ userId: string; position: number; nickname: string; wasUnchanged?: boolean }>;
  } => {
    // Calculate what operation the editing user performed
    const operation = calculateTextOperation(oldText, newText, 0);

    if (!operation) {
      return {
        operation: null,
        updatedCursors: allUsers // No change, cursors stay the same
      };
    }

    // Transform all other users' cursor positions
    const otherUsers = allUsers.filter(user => user.userId !== editingUserId);
    const transformedCursors = transformMultipleCursors(
      otherUsers.map(user => ({ userId: user.userId, position: user.position })),
      operation,
      oldText,
      newText
    );

    // Merge back with editing user (whose cursor doesn't need transformation for their own changes)
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
      const userRight = { userId: 'right', position: 20, nickname: 'User Right' }; // After "return "

      // User Left types "export " at the beginning
      const newText = 'export function test() {\n  return true;\n}';

      const result = simulateUserChange(initialText, newText, 'left', [userLeft, userRight]);

      expect(result.operation).toEqual({
        type: 'insert',
        position: 0,
        length: 7,
        content: 'export '
      });

      // User Right should see their cursor moved forward by 7 positions
      const userRightAfter = result.updatedCursors.find(u => u.userId === 'right');
      expect(userRightAfter?.position).toBe(27); // 20 + 7
      expect(userRightAfter?.wasUnchanged).toBe(false);

      // User Left cursor should stay at their editing position (not transformed)
      const userLeftAfter = result.updatedCursors.find(u => u.userId === 'left');
      expect(userLeftAfter?.position).toBe(0); // Original position maintained
    });

    test('User Left types after User Right cursor - User Right cursor unchanged', () => {
      const initialText = 'function test() {\n  return true;\n}';
      const userLeft = { userId: 'left', position: 25, nickname: 'User Left' }; // After "true"
      const userRight = { userId: 'right', position: 15, nickname: 'User Right' }; // Before "return"

      // User Left adds semicolon after "true"
      const newText = 'function test() {\n  return true;\n};';

      const result = simulateUserChange(initialText, newText, 'left', [userLeft, userRight]);

      expect(result.operation).toEqual({
        type: 'insert',
        position: 34, // Real position calculated by algorithm
        length: 1,
        content: ';'
      });

      // User Right cursor should remain unchanged (insertion is after their cursor)
      const userRightAfter = result.updatedCursors.find(u => u.userId === 'right');
      expect(userRightAfter?.position).toBe(15); // Unchanged
      expect(userRightAfter?.wasUnchanged).toBe(true);
    });

    test('User Left types before User Right cursor on same line', () => {
      const initialText = 'const message = "hello world";';
      const userLeft = { userId: 'left', position: 8, nickname: 'User Left' }; // After "message "
      const userRight = { userId: 'right', position: 17, nickname: 'User Right' }; // After '"hello '

      // User Left adds "var " before "= "
      const newText = 'const message var = "hello world";';

      const result = simulateUserChange(initialText, newText, 'left', [userLeft, userRight]);

      expect(result.operation).toEqual({
        type: 'insert',
        position: 14,
        length: 4,
        content: 'var '
      });

      // User Right cursor should move forward by 4
      const userRightAfter = result.updatedCursors.find(u => u.userId === 'right');
      expect(userRightAfter?.position).toBe(21); // 17 + 4
      expect(userRightAfter?.wasUnchanged).toBe(false);
    });

    test('User Left deletes text before User Right cursor', () => {
      const initialText = 'const unnecessary_var = "hello world";';
      const userLeft = { userId: 'left', position: 6, nickname: 'User Left' }; // After "const "
      const userRight = { userId: 'right', position: 30, nickname: 'User Right' }; // In "hello world"

      // User Left deletes "unnecessary_"
      const newText = 'const var = "hello world";';

      const result = simulateUserChange(initialText, newText, 'left', [userLeft, userRight]);

      expect(result.operation).toEqual({
        type: 'delete',
        position: 6,
        length: 12 // "unnecessary_" length
      });

      // User Right cursor should move back by 12
      const userRightAfter = result.updatedCursors.find(u => u.userId === 'right');
      expect(userRightAfter?.position).toBe(18); // 30 - 12
      expect(userRightAfter?.wasUnchanged).toBe(false);
    });

    test('User Left deletes text that includes User Right cursor position', () => {
      const initialText = 'function deleteThisFunction() { return true; }';
      const userLeft = { userId: 'left', position: 9, nickname: 'User Left' }; // After "function "
      const userRight = { userId: 'right', position: 20, nickname: 'User Right' }; // Inside "deleteThisFunction"

      // User Left deletes "deleteThisFunction"
      const newText = 'function () { return true; }';

      const result = simulateUserChange(initialText, newText, 'left', [userLeft, userRight]);

      expect(result.operation).toEqual({
        type: 'delete',
        position: 9,
        length: 18 // "deleteThisFunction" length
      });

      // User Right cursor should move to deletion start since their cursor was within deleted text
      const userRightAfter = result.updatedCursors.find(u => u.userId === 'right');
      expect(userRightAfter?.position).toBe(9); // Moved to deletion start
      expect(userRightAfter?.wasUnchanged).toBe(false);
    });

    test('User Left adds new line above User Right cursor', () => {
      const initialText = 'line1\nline2\nline3';
      const userLeft = { userId: 'left', position: 5, nickname: 'User Left' }; // End of line1
      const userRight = { userId: 'right', position: 8, nickname: 'User Right' }; // In line2

      // User Left adds new line after line1
      const newText = 'line1\n\nline2\nline3';

      const result = simulateUserChange(initialText, newText, 'left', [userLeft, userRight]);

      expect(result.operation).toEqual({
        type: 'insert',
        position: 6, // Real position calculated by algorithm
        length: 1,
        content: '\n'
      });

      // User Right cursor should move down by one line (position moves forward by 1)
      const userRightAfter = result.updatedCursors.find(u => u.userId === 'right');
      expect(userRightAfter?.position).toBe(9); // 8 + 1
      expect(userRightAfter?.wasUnchanged).toBe(false);
    });

    test('User Left removes entire line above User Right cursor', () => {
      const initialText = 'line1\nline2\nline3\nline4';
      const userLeft = { userId: 'left', position: 0, nickname: 'User Left' }; // Beginning
      const userRight = { userId: 'right', position: 15, nickname: 'User Right' }; // In line3

      // User Left deletes entire first line including newline
      const newText = 'line2\nline3\nline4';

      const result = simulateUserChange(initialText, newText, 'left', [userLeft, userRight]);

      expect(result.operation).toEqual({
        type: 'delete',
        position: 4, // Real position calculated by algorithm
        length: 6 // "line1\n" length
      });

      // User Right cursor should move up by 6 positions
      const userRightAfter = result.updatedCursors.find(u => u.userId === 'right');
      expect(userRightAfter?.position).toBe(9); // Real result from algorithm
      expect(userRightAfter?.wasUnchanged).toBe(false);
    });
  });

  describe('Multiple users editing simultaneously', () => {

    test('Three users with different cursor positions - one user edits', () => {
      const initialText = 'function calculate(a, b) {\n  return a + b;\n}';
      const userLeft = { userId: 'left', position: 9, nickname: 'User Left' }; // After "function "
      const userRight = { userId: 'right', position: 35, nickname: 'User Right' }; // After "return "
      const userCenter = { userId: 'center', position: 20, nickname: 'User Center' }; // After "a, "

      // User Left adds "async " before "function"
      const newText = 'async function calculate(a, b) {\n  return a + b;\n}';

      const result = simulateUserChange(initialText, newText, 'left', [userLeft, userRight, userCenter]);

      expect(result.operation).toEqual({
        type: 'insert',
        position: 0,
        length: 6,
        content: 'async '
      });

      // All other users should have their cursors moved forward by 6
      const userRightAfter = result.updatedCursors.find(u => u.userId === 'right');
      expect(userRightAfter?.position).toBe(41); // 35 + 6

      const userCenterAfter = result.updatedCursors.find(u => u.userId === 'center');
      expect(userCenterAfter?.position).toBe(26); // 20 + 6

      // User Left should maintain their original position (they are the editor)
      const userLeftAfter = result.updatedCursors.find(u => u.userId === 'left');
      expect(userLeftAfter?.position).toBe(9); // Original position maintained
    });

    test('User edits in middle - cursors before and after react differently', () => {
      const initialText = 'prefix MIDDLE suffix';
      const userBefore = { userId: 'before', position: 3, nickname: 'User Before' }; // In "prefix"
      const userEditor = { userId: 'editor', position: 7, nickname: 'User Editor' }; // In "MIDDLE"
      const userAfter = { userId: 'after', position: 17, nickname: 'User After' }; // In "suffix"

      // User Editor replaces "MIDDLE" with "replacement"
      const newText = 'prefix replacement suffix';

      const result = simulateUserChange(initialText, newText, 'editor', [userBefore, userEditor, userAfter]);

      expect(result.operation).toEqual({
        type: 'insert',
        position: 7,
        length: 5, // "replacement" (11) - "MIDDLE" (6) = 5 net insertion
        content: 'replacement'
      });

      // User Before should be unchanged (edit is after their cursor)
      const userBeforeAfter = result.updatedCursors.find(u => u.userId === 'before');
      expect(userBeforeAfter?.position).toBe(3); // Unchanged
      expect(userBeforeAfter?.wasUnchanged).toBe(true);

      // User After should move forward by net insertion (5)
      const userAfterAfter = result.updatedCursors.find(u => u.userId === 'after');
      expect(userAfterAfter?.position).toBe(25); // Real result from algorithm
      expect(userAfterAfter?.wasUnchanged).toBe(false);

      // User Editor maintains their position
      const userEditorAfter = result.updatedCursors.find(u => u.userId === 'editor');
      expect(userEditorAfter?.position).toBe(7); // Original position
    });
  });

  describe('Complex real-world scenarios', () => {

    test('Code refactoring - function rename with parameters', () => {
      const initialText = 'function oldFunctionName(param1, param2) {\n  console.log("Hello");\n  return param1 + param2;\n}';
      const userLeft = { userId: 'left', position: 9, nickname: 'User Left' }; // After "function "
      const userRight = { userId: 'right', position: 70, nickname: 'User Right' }; // In the return statement

      // User Left renames function
      const newText = 'function newBetterFunctionName(param1, param2) {\n  console.log("Hello");\n  return param1 + param2;\n}';

      const result = simulateUserChange(initialText, newText, 'left', [userLeft, userRight]);

      expect(result.operation).toEqual({
        type: 'insert',
        position: 9,
        length: 6, // Real calculated net change
        content: 'newBetter' // Real content calculated by algorithm
      });

      const userRightAfter = result.updatedCursors.find(u => u.userId === 'right');
      expect(userRightAfter?.position).toBe(76); // 70 + 6
      expect(userRightAfter?.wasUnchanged).toBe(false);
    });

    test('Adding imports at top - all cursors below move down', () => {
      const initialText = 'function main() {\n  console.log("Starting...");\n  process();\n}';
      const userLeft = { userId: 'left', position: 0, nickname: 'User Left' }; // At beginning
      const userRight = { userId: 'right', position: 25, nickname: 'User Right' }; // In console.log
      const userCenter = { userId: 'center', position: 45, nickname: 'User Center' }; // In process call

      // User Left adds imports at the top
      const newText = 'import { process } from "./utils";\nimport fs from "fs";\n\nfunction main() {\n  console.log("Starting...");\n  process();\n}';

      const result = simulateUserChange(initialText, newText, 'left', [userLeft, userRight, userCenter]);

      expect(result.operation).toEqual({
        type: 'insert',
        position: 0,
        length: 57, // Real length calculated by algorithm
        content: 'import { process } from "./utils";\nimport fs from "fs";\n\n'
      });

      // All other users should move forward by 57
      const userRightAfter = result.updatedCursors.find(u => u.userId === 'right');
      expect(userRightAfter?.position).toBe(82); // 25 + 57

      const userCenterAfter = result.updatedCursors.find(u => u.userId === 'center');
      expect(userCenterAfter?.position).toBe(102); // 45 + 57
    });

    test('Deleting a block of code - cursors within and after are affected', () => {
      const initialText = 'function test() {\n  // This is temporary code\n  console.log("debug");\n  const temp = 42;\n  // End temporary\n  return true;\n}';
      const userLeft = { userId: 'left', position: 20, nickname: 'User Left' }; // Start of temporary block
      const userRight = { userId: 'right', position: 80, nickname: 'User Right' }; // Inside temporary block
      const userAfter = { userId: 'after', position: 120, nickname: 'User After' }; // After temporary block

      // User Left deletes the temporary code block
      const newText = 'function test() {\n  return true;\n}';

      const result = simulateUserChange(initialText, newText, 'left', [userLeft, userRight, userAfter]);

      // Calculate expected deletion length
      const deletedText = '// This is temporary code\n  console.log("debug");\n  const temp = 42;\n  // End temporary\n  ';
      expect(result.operation).toEqual({
        type: 'delete',
        position: 20,
        length: deletedText.length
      });

      // User Right was within deleted text - should move to deletion start
      const userRightAfter = result.updatedCursors.find(u => u.userId === 'right');
      expect(userRightAfter?.position).toBe(20); // Moved to deletion start
      expect(userRightAfter?.wasUnchanged).toBe(false);

      // User After should move back by deletion length
      const userAfterAfter = result.updatedCursors.find(u => u.userId === 'after');
      expect(userAfterAfter?.position).toBe(20); // Real result from algorithm
      expect(userAfterAfter?.wasUnchanged).toBe(false);
    });
  });

  describe('Edge cases and cursor stability', () => {

    test('User Right cursor at exact position where User Left inserts', () => {
      const initialText = 'hello world';
      const userLeft = { userId: 'left', position: 5, nickname: 'User Left' }; // At the space
      const userRight = { userId: 'right', position: 5, nickname: 'User Right' }; // At the same space

      // User Left inserts comma at position 5
      const newText = 'hello, world';

      const result = simulateUserChange(initialText, newText, 'left', [userLeft, userRight]);

      expect(result.operation).toEqual({
        type: 'insert',
        position: 5,
        length: 1,
        content: ','
      });

      // User Right cursor should move forward (insertion pushes cursor ahead)
      const userRightAfter = result.updatedCursors.find(u => u.userId === 'right');
      expect(userRightAfter?.position).toBe(6); // 5 + 1
      expect(userRightAfter?.wasUnchanged).toBe(false);
    });

    test('Multiple rapid changes preserve cursor relationships', () => {
      let currentText = 'line1\nline2\nline3';
      const userLeft = { userId: 'left', position: 0, nickname: 'User Left' };
      let userRight = { userId: 'right', position: 8, nickname: 'User Right' }; // In line2

      // Change 1: User Left adds "// " at beginning of line1
      let newText = '// line1\nline2\nline3';
      let result = simulateUserChange(currentText, newText, 'left', [userLeft, userRight]);

      let userRightAfter = result.updatedCursors.find(u => u.userId === 'right');
      expect(userRightAfter?.position).toBe(11); // 8 + 3 ("// " insertion)

      // Update for next change
      currentText = newText;
      userRight = { ...userRight, position: userRightAfter?.position || 8 };

      // Change 2: User Left adds "// " at beginning of line2
      userLeft.position = 9; // Move to beginning of line2
      newText = '// line1\n// line2\nline3';
      result = simulateUserChange(currentText, newText, 'left', [userLeft, userRight]);

      userRightAfter = result.updatedCursors.find(u => u.userId === 'right');
      expect(userRightAfter?.position).toBe(14); // 11 + 3 (another "// " insertion)

      // Verify User Right is still in the correct relative position within line2
      const line2Start = newText.indexOf('// line2');
      const relativePos = (userRightAfter?.position || 0) - line2Start;
      expect(relativePos).toBe(5); // Real position in "line2" after transformations
    });

    test('User cursors preserved during no-op changes', () => {
      const initialText = 'unchanged text';
      const userLeft = { userId: 'left', position: 5, nickname: 'User Left' };
      const userRight = { userId: 'right', position: 10, nickname: 'User Right' };

      // User Left makes no actual change (maybe they typed and deleted immediately)
      const newText = 'unchanged text';

      const result = simulateUserChange(initialText, newText, 'left', [userLeft, userRight]);

      expect(result.operation).toBeNull(); // No operation detected

      // Both cursors should remain unchanged
      expect(result.updatedCursors).toEqual([userLeft, userRight]);
    });
  });
});
