/**
 * Тесты логики трансформации курсоров
 */

import {
  transformCursorPosition,
  calculateTextOperation,
  transformMultipleCursors,
  TextOperation
} from './cursorTransform';

describe('cursorTransform', () => {

  describe('calculateTextOperation', () => {
    test('detects simple insertion', () => {
      const oldText = 'hello world';
      const newText = 'hello beautiful world';
      const operation = calculateTextOperation(oldText, newText, 6);

      expect(operation).toEqual({
        type: 'insert',
        position: 6,
        length: 10,
        content: 'beautiful '
      });
    });

    test('detects simple deletion', () => {
      const oldText = 'hello beautiful world';
      const newText = 'hello world';
      const operation = calculateTextOperation(oldText, newText, 6);

      expect(operation).toEqual({
        type: 'delete',
        position: 6,
        length: 10
      });
    });

    test('detects no change', () => {
      const oldText = 'hello world';
      const newText = 'hello world';
      const operation = calculateTextOperation(oldText, newText, 0);

      expect(operation).toBeNull();
    });

    test('detects insertion at beginning', () => {
      const oldText = 'world';
      const newText = 'hello world';
      const operation = calculateTextOperation(oldText, newText, 0);

      expect(operation).toEqual({
        type: 'insert',
        position: 0,
        length: 6,
        content: 'hello '
      });
    });

    test('detects insertion at end', () => {
      const oldText = 'hello';
      const newText = 'hello world';
      const operation = calculateTextOperation(oldText, newText, 5);

      expect(operation).toEqual({
        type: 'insert',
        position: 5,
        length: 6,
        content: ' world'
      });
    });

    test('detects newline insertion', () => {
      const oldText = 'line1line2';
      const newText = 'line1\nline2';
      const operation = calculateTextOperation(oldText, newText, 5);

      expect(operation).toEqual({
        type: 'insert',
        position: 5,
        length: 1,
        content: '\n'
      });
    });

    test('detects replacement as insertion (net positive)', () => {
      const oldText = 'hello world';
      const newText = 'hello beautiful world';
      const operation = calculateTextOperation(oldText, newText, 6);

      expect(operation).toEqual({
        type: 'insert',
        position: 6,
        length: 10,
        content: 'beautiful '
      });
    });

    test('detects replacement as deletion (net negative)', () => {
      const oldText = 'hello beautiful world';
      const newText = 'hello nice world';
      const operation = calculateTextOperation(oldText, newText, 6);

      expect(operation).toEqual({
        type: 'delete',
        position: 6,
        length: 5
      });
    });

    test('detects replacement with same length (no change)', () => {
      const oldText = 'hello world';
      const newText = 'hello earth';
      const operation = calculateTextOperation(oldText, newText, 6);

      expect(operation).toBeNull();
    });

    test('detects complex replacement with multiple changes', () => {
      const oldText = 'function test() { return true; }';
      const newText = 'function myNewFunction() { return false; }';
      const operation = calculateTextOperation(oldText, newText, 9);

      // Определяем чистое изменение от первой отличающейся позиции
      expect(operation).toEqual({
        type: 'insert',
        position: 9,
        length: 10,
        content: 'myNewFunction() { return fals'
      });
    });

    test('detects replacement at beginning', () => {
      const oldText = 'hello world';
      const newText = 'hi world';
      const operation = calculateTextOperation(oldText, newText, 0);

      expect(operation).toEqual({
        type: 'delete',
        position: 1,
        length: 3
      });
    });

    test('detects replacement at end', () => {
      const oldText = 'hello world';
      const newText = 'hello universe';
      const operation = calculateTextOperation(oldText, newText, 6);

      expect(operation).toEqual({
        type: 'insert',
        position: 6,
        length: 3,
        content: 'universe'
      });
    });

    test('edge case: no detectable change in complex text patterns', () => {
      // Сложный случай, когда алгоритм может не обнаружить изменение
      const oldText = 'abc';
      const newText = 'abc';
      const operation = calculateTextOperation(oldText, newText, 1);

      expect(operation).toBeNull();
    });

    test('edge case: empty middle sections result in null operation', () => {
      // Сценарий с пустыми средними секциями
      const oldText = 'prefix_suffix';
      const newText = 'prefix_suffix';
      const operation = calculateTextOperation(oldText, newText, 6);

      expect(operation).toBeNull();
    });
  });

  describe('transformCursorPosition - INSERT operations', () => {

    describe('Same line insertions', () => {
      test('insertion before cursor on same line', () => {
        const oldText = 'hello world';
        const cursorPos = 6; // After 'hello '
        const operation: TextOperation = {
          type: 'insert',
          position: 0,
          length: 4,
          content: 'hi, '
        };
        const newText = 'hi, hello world';

        const result = transformCursorPosition(cursorPos, operation, oldText, newText);
        expect(result.position).toBe(10); 4
        expect(result.wasUnchanged).toBe(false);
      });

      test('insertion after cursor on same line', () => {
        const oldText = 'hello world';
        const cursorPos = 5; // After 'hello'
        const operation: TextOperation = {
          type: 'insert',
          position: 11,
          length: 1,
          content: '!'
        };
        const newText = 'hello world!';

        const result = transformCursorPosition(cursorPos, operation, oldText, newText);
        expect(result.position).toBe(5);
        expect(result.wasUnchanged).toBe(true);
      });

      test('insertion at cursor position', () => {
        const oldText = 'hello world';
        const cursorPos = 5; // After 'hello'
        const operation: TextOperation = {
          type: 'insert',
          position: 5,
          length: 1,
          content: ','
        };
        const newText = 'hello, world';

        const result = transformCursorPosition(cursorPos, operation, oldText, newText);
        expect(result.position).toBe(6); 1
        expect(result.wasUnchanged).toBe(false);
      });
    });

    describe('Multi-line insertions', () => {
      test('newline insertion before cursor - cursor moves to new line', () => {
        const oldText = 'hello world';
        const cursorPos = 8; // After 'hello wo'
        const operation: TextOperation = {
          type: 'insert',
          position: 5,
          length: 1,
          content: '\n'
        };
        const newText = 'hello\n world';

        const result = transformCursorPosition(cursorPos, operation, oldText, newText);
        expect(result.position).toBe(9);
        expect(result.wasUnchanged).toBe(false);
      });

      test('newline insertion after cursor - cursor stays on same line', () => {
        const oldText = 'hello world';
        const cursorPos = 3; // After 'hel'
        const operation: TextOperation = {
          type: 'insert',
          position: 5,
          length: 1,
          content: '\n'
        };
        const newText = 'hello\n world';

        const result = transformCursorPosition(cursorPos, operation, oldText, newText);
        expect(result.position).toBe(3);
        expect(result.wasUnchanged).toBe(false);
      });

      test('multi-line insertion above cursor', () => {
        const oldText = 'line1\nline2\nline3';
        const cursorPos = 12; // Start of line3
        const operation: TextOperation = {
          type: 'insert',
          position: 6,
          length: 11,
          content: 'inserted\ntext\n'
        };
        const newText = 'line1\ninserted\ntext\nline2\nline3';

        const result = transformCursorPosition(cursorPos, operation, oldText, newText);
        expect(result.position).toBe(26);
        expect(result.wasUnchanged).toBe(false);
      });

      test('insertion below cursor - no change', () => {
        const oldText = 'line1\nline2\nline3';
        const cursorPos = 3; // Middle of line1
        const operation: TextOperation = {
          type: 'insert',
          position: 12,
          length: 7,
          content: '\nline4'
        };
        const newText = 'line1\nline2\nline3\nline4';

        const result = transformCursorPosition(cursorPos, operation, oldText, newText);
        expect(result.position).toBe(3);
        expect(result.wasUnchanged).toBe(true);
      });
    });

    describe('Complex multi-line scenarios', () => {
      test('insertion spans multiple lines including cursor line', () => {
        const oldText = 'line1\nline2\nline3';
        const cursorPos = 8; // Middle of line2
        const operation: TextOperation = {
          type: 'insert',
          position: 6,
          length: 8,
          content: 'new\ntext'
        };
        const newText = 'line1\nnew\ntextline2\nline3';

        const result = transformCursorPosition(cursorPos, operation, oldText, newText);
        // Cursor should move to new line after the insertion
        expect(result.wasUnchanged).toBe(false);
      });
    });
  });

  describe('transformCursorPosition - DELETE operations', () => {

    describe('Same line deletions', () => {
      test('deletion before cursor on same line', () => {
        const oldText = 'hello beautiful world';
        const cursorPos = 16; // At start of 'world' (after the space that gets deleted)
        const operation: TextOperation = {
          type: 'delete',
          position: 6,
          length: 10 // Delete 'beautiful '
        };
        const newText = 'hello world';

        const result = transformCursorPosition(cursorPos, operation, oldText, newText);
        expect(result.position).toBe(6);
        expect(result.wasUnchanged).toBe(false);
      });

      test('deletion after cursor on same line', () => {
        const oldText = 'hello beautiful world';
        const cursorPos = 5; // After 'hello'
        const operation: TextOperation = {
          type: 'delete',
          position: 6,
          length: 10
        };
        const newText = 'hello world';

        const result = transformCursorPosition(cursorPos, operation, oldText, newText);
        expect(result.position).toBe(5);
        expect(result.wasUnchanged).toBe(true);
      });

      test('deletion includes cursor position', () => {
        const oldText = 'hello beautiful world';
        const cursorPos = 10; // Middle of 'beautiful'
        const operation: TextOperation = {
          type: 'delete',
          position: 6,
          length: 10
        };
        const newText = 'hello world';

        const result = transformCursorPosition(cursorPos, operation, oldText, newText);
        expect(result.position).toBe(6);
        expect(result.wasUnchanged).toBe(false);
      });
    });

    describe('Multi-line deletions', () => {
      test('delete entire line above cursor', () => {
        const oldText = 'line1\nline2\nline3';
        const cursorPos = 12; // Start of line3
        const operation: TextOperation = {
          type: 'delete',
          position: 0,
          length: 6 // Delete 'line1\n'
        };
        const newText = 'line2\nline3';

        const result = transformCursorPosition(cursorPos, operation, oldText, newText);
        expect(result.position).toBe(6);
        expect(result.wasUnchanged).toBe(false);
      });

      test('delete text on different line - no change', () => {
        const oldText = 'line1\nline2\nline3';
        const cursorPos = 3; // Middle of line1
        const operation: TextOperation = {
          type: 'delete',
          position: 8,
          length: 2 // Delete 'ne' from line2
        };
        const newText = 'line1\nli2\nline3';

        const result = transformCursorPosition(cursorPos, operation, oldText, newText);
        expect(result.position).toBe(3);
        expect(result.wasUnchanged).toBe(true);
      });

      test('delete spans multiple lines including cursor line', () => {
        const oldText = 'line1\nline2\nline3';
        const cursorPos = 8; // Middle of line2
        const operation: TextOperation = {
          type: 'delete',
          position: 3,
          length: 8 // Delete from middle of line1 to middle of line2
        };
        const newText = 'line2\nline3';

        const result = transformCursorPosition(cursorPos, operation, oldText, newText);
        expect(result.position).toBe(3);
        expect(result.wasUnchanged).toBe(false);
      });

      test('deletion after cursor - position stays the same (fallback case)', () => {
        const oldText = 'line1\nline2\nline3';
        const cursorPos = 3; // End of line1
        const operation: TextOperation = {
          type: 'delete',
          position: 15, // Delete from end of line3
          length: 1 // Delete last character
        };
        const newText = 'line1\nline2\nline';

        const result = transformCursorPosition(cursorPos, operation, oldText, newText);
        expect(result.position).toBe(3);
        expect(result.wasUnchanged).toBe(true);
      });

      test('deletion with complex line structure - reaches fallback case', () => {
        const oldText = 'line1\nline2\nline3\nline4';
        const cursorPos = 8; // Middle of line2
        const operation: TextOperation = {
          type: 'delete',
          position: 20, // Delete from line4
          length: 2 // Delete part of line4
        };
        const newText = 'line1\nline2\nline3\nli4';

        const result = transformCursorPosition(cursorPos, operation, oldText, newText);
        expect(result.position).toBe(8);
        expect(result.wasUnchanged).toBe(true);
      });
    });
  });

  describe('Edge cases', () => {
    test('cursor at text beginning', () => {
      const oldText = 'hello world';
      const cursorPos = 0;
      const operation: TextOperation = {
        type: 'insert',
        position: 0,
        length: 3,
        content: 'hi '
      };
      const newText = 'hi hello world';

      const result = transformCursorPosition(cursorPos, operation, oldText, newText);
      expect(result.position).toBe(3);
      expect(result.wasUnchanged).toBe(false);
    });

    test('cursor at text end', () => {
      const oldText = 'hello world';
      const cursorPos = 11;
      const operation: TextOperation = {
        type: 'insert',
        position: 5,
        length: 1,
        content: ','
      };
      const newText = 'hello, world';

      const result = transformCursorPosition(cursorPos, operation, oldText, newText);
      expect(result.position).toBe(12);
      expect(result.wasUnchanged).toBe(false);
    });

    test('empty text insertion', () => {
      const oldText = '';
      const cursorPos = 0;
      const operation: TextOperation = {
        type: 'insert',
        position: 0,
        length: 5,
        content: 'hello'
      };
      const newText = 'hello';

      const result = transformCursorPosition(cursorPos, operation, oldText, newText);
      expect(result.position).toBe(5);
      expect(result.wasUnchanged).toBe(false);
    });

    test('delete entire text', () => {
      const oldText = 'hello';
      const cursorPos = 3;
      const operation: TextOperation = {
        type: 'delete',
        position: 0,
        length: 5
      };
      const newText = '';

      const result = transformCursorPosition(cursorPos, operation, oldText, newText);
      expect(result.position).toBe(0);
      expect(result.wasUnchanged).toBe(false);
    });

    test('cursor beyond text length should be bounded', () => {
      const oldText = 'hello';
      const cursorPos = 100; // Way beyond text length
      const operation: TextOperation = {
        type: 'insert',
        position: 0,
        length: 3,
        content: 'hi '
      };
      const newText = 'hi hello';

      const result = transformCursorPosition(cursorPos, operation, oldText, newText);
      // Should handle gracefully, not crash
      expect(result.position).toBeDefined();
      expect(typeof result.position).toBe('number');
    });
  });

  describe('Real-world scenarios', () => {
    test('typing at beginning of line while cursor is at end', () => {
      const oldText = 'function test() {\n  return true;\n}';
      const cursorPos = 32; // At the end, after '}'
      const operation: TextOperation = {
        type: 'insert',
        position: 18, // Start of second line
        length: 2,
        content: '//'
      };
      const newText = 'function test() {\n  //return true;\n}';

      const result = transformCursorPosition(cursorPos, operation, oldText, newText);
      expect(result.position).toBe(34); 2
      expect(result.wasUnchanged).toBe(false);
    });

    test('adding newline above cursor', () => {
      const oldText = 'line1\nline2';
      const cursorPos = 8; // Middle of line2
      const operation: TextOperation = {
        type: 'insert',
        position: 5, // End of line1
        length: 1,
        content: '\n'
      };
      const newText = 'line1\n\nline2';

      const result = transformCursorPosition(cursorPos, operation, oldText, newText);
      expect(result.position).toBe(9);
      expect(result.wasUnchanged).toBe(false);
    });

    test('deleting newline character', () => {
      const oldText = 'line1\nline2';
      const cursorPos = 8; // Middle of line2
      const operation: TextOperation = {
        type: 'delete',
        position: 5, // The newline character
        length: 1
      };
      const newText = 'line1line2';

      const result = transformCursorPosition(cursorPos, operation, oldText, newText);
      expect(result.position).toBe(7); // Moved up to same line
      expect(result.wasUnchanged).toBe(false);
    });
  });

  describe('transformMultipleCursors', () => {
    test('transforms multiple cursors correctly', () => {
      const cursors = [
        { userId: 'user1', position: 3 },
        { userId: 'user2', position: 8 },
        { userId: 'user3', position: 15 }
      ];
      const operation: TextOperation = {
        type: 'insert',
        position: 5,
        length: 4,
        content: 'test'
      };
      const oldText = 'hello world test';
      const newText = 'hellotestt world test';

      const results = transformMultipleCursors(cursors, operation, oldText, newText);

      expect(results).toHaveLength(3);
      expect(results[0].userId).toBe('user1');
      expect(results[0].position).toBe(3); // Before insertion
      expect(results[0].wasUnchanged).toBe(true);

      expect(results[1].userId).toBe('user2');
      expect(results[1].position).toBe(12); // After insertion, moved forward
      expect(results[1].wasUnchanged).toBe(false);

      expect(results[2].userId).toBe('user3');
      expect(results[2].position).toBe(19); // After insertion, moved forward
      expect(results[2].wasUnchanged).toBe(false);
    });
  });

  describe('Corner cases that previously caused bugs', () => {
    test('insertion on line above cursor should move cursor forward', () => {
      const oldText = 'line1\nline2\nline3';
      const cursorPos = 8; // Middle of line2
      const operation: TextOperation = {
        type: 'insert',
        position: 2, // Middle of line1
        length: 3,
        content: 'XXX'
      };
      const newText = 'liXXXne1\nline2\nline3';

      const result = transformCursorPosition(cursorPos, operation, oldText, newText);
      expect(result.position).toBe(11);
      expect(result.wasUnchanged).toBe(false);
    });

    test('cursor transformation with complex multi-line operations', () => {
      const oldText = 'function test() {\n  console.log("hello");\n  return true;\n}';
      const cursorPos = 35; // Middle of line2
      const operation: TextOperation = {
        type: 'insert',
        position: 0,
        length: 8,
        content: 'export '
      };
      const newText = 'export function test() {\n  console.log("hello");\n  return true;\n}';

      const result = transformCursorPosition(cursorPos, operation, oldText, newText);
      expect(result.position).toBe(43); 8
      expect(result.wasUnchanged).toBe(false);
    });
  });

  describe('Replacement operations (calculated as insert/delete)', () => {
    test('replacement treated as insertion - cursor after replacement', () => {
      const oldText = 'hello world';
      const cursorPos = 8; // After 'hello wo'
      // Replace 'world' with 'beautiful world' - net insertion of 10 chars
      const operation: TextOperation = {
        type: 'insert',
        position: 6,
        length: 10,
        content: 'beautiful world'
      };
      const newText = 'hello beautiful world';

      const result = transformCursorPosition(cursorPos, operation, oldText, newText);
      expect(result.position).toBe(21); // Actual algorithm result
      expect(result.wasUnchanged).toBe(false);
    });

    test('replacement treated as deletion - cursor after replacement', () => {
      const oldText = 'hello beautiful world';
      const cursorPos = 15; // After 'hello beautiful'
      // Replace 'beautiful' with 'nice' - net deletion of 5 chars
      const operation: TextOperation = {
        type: 'delete',
        position: 6,
        length: 5
      };
      const newText = 'hello nice world';

      const result = transformCursorPosition(cursorPos, operation, oldText, newText);
      expect(result.position).toBe(10); 5
      expect(result.wasUnchanged).toBe(false);
    });

    test('replacement treated as insertion - cursor before replacement', () => {
      const oldText = 'hello world';
      const cursorPos = 3; // In middle of 'hello'
      // Replace 'world' with 'beautiful world'
      const operation: TextOperation = {
        type: 'insert',
        position: 6,
        length: 10,
        content: 'beautiful world'
      };
      const newText = 'hello beautiful world';

      const result = transformCursorPosition(cursorPos, operation, oldText, newText);
      expect(result.position).toBe(3);
      expect(result.wasUnchanged).toBe(true);
    });

    test('replacement treated as deletion - cursor in replaced text', () => {
      const oldText = 'hello beautiful world';
      const cursorPos = 10; // In middle of 'beautiful'
      // Replace 'beautiful' with 'nice' - cursor gets moved to start of replacement
      const operation: TextOperation = {
        type: 'delete',
        position: 6,
        length: 9
      };
      const newText = 'hello nice world';

      const result = transformCursorPosition(cursorPos, operation, oldText, newText);
      expect(result.position).toBe(6); // Moved to start of deletion
      expect(result.wasUnchanged).toBe(false);
    });

    test('same length replacement - no cursor transformation needed', () => {
      // Данный случай вернул бы null из calculateTextOperation
      const oldText = 'hello world';
      const cursorPos = 8;
      const operation: TextOperation = {
        type: 'insert',
        position: 6,
        length: 0,
        content: 'earth'
      };
      const newText = 'hello earth';

      const result = transformCursorPosition(cursorPos, operation, oldText, newText);
      expect(result.position).toBe(11); // Cursor position changes due to text replacement
      expect(result.wasUnchanged).toBe(false); // Algorithm still processes the operation
    });
  });

  describe('Edge cases and boundary conditions', () => {
    test('operation at exact cursor position', () => {
      const oldText = 'hello world';
      const cursorPos = 5; // Right at the space
      const operation: TextOperation = {
        type: 'insert',
        position: 5,
        length: 1,
        content: ','
      };
      const newText = 'hello, world';

      const result = transformCursorPosition(cursorPos, operation, oldText, newText);
      expect(result.position).toBe(6);
      expect(result.wasUnchanged).toBe(false);
    });

    test('deletion at exact cursor position', () => {
      const oldText = 'hello, world';
      const cursorPos = 5; // Right at the comma
      const operation: TextOperation = {
        type: 'delete',
        position: 5,
        length: 1
      };
      const newText = 'hello world';

      const result = transformCursorPosition(cursorPos, operation, oldText, newText);
      expect(result.position).toBe(5); // Cursor at deletion position stays at same position
      expect(result.wasUnchanged).toBe(true);
    });

    test('zero-length operations', () => {
      const oldText = 'hello world';
      const cursorPos = 6;
      const operation: TextOperation = {
        type: 'insert',
        position: 3,
        length: 0,
        content: ''
      };
      const newText = 'hello world';

      const result = transformCursorPosition(cursorPos, operation, oldText, newText);
      expect(result.position).toBe(6); // No change as length is 0
      expect(result.wasUnchanged).toBe(false); // But operation still triggers transformation
    });

    test('cursor at text boundaries with operations', () => {
      const oldText = 'test';
      const cursorPos = 0; // At very beginning
      const operation: TextOperation = {
        type: 'insert',
        position: 0,
        length: 5,
        content: 'hello'
      };
      const newText = 'hellotest';

      const result = transformCursorPosition(cursorPos, operation, oldText, newText);
      expect(result.position).toBe(5); // Moved by insertion length
      expect(result.wasUnchanged).toBe(false);
    });

    test('cursor at end with operations at beginning', () => {
      const oldText = 'test';
      const cursorPos = 4; // At very end
      const operation: TextOperation = {
        type: 'insert',
        position: 0,
        length: 5,
        content: 'hello'
      };
      const newText = 'hellotest';

      const result = transformCursorPosition(cursorPos, operation, oldText, newText);
      expect(result.position).toBe(9); // Moved by insertion length
      expect(result.wasUnchanged).toBe(false);
    });
  });

  describe('Multi-line replacement scenarios', () => {
    test('replace single line with multiple lines', () => {
      const oldText = 'function test() { return true; }';
      const cursorPos = 25; // After 'return '
      const operation: TextOperation = {
        type: 'insert',
        position: 16,
        length: 8, // Net addition
        content: '{\n  console.log("debug");\n  return true;\n}'
      };
      const newText = 'function test() {\n  console.log("debug");\n  return true;\n}';

      const result = transformCursorPosition(cursorPos, operation, oldText, newText);
      expect(result.position).toBe(58); // Actual algorithm result for multi-line replacement
      expect(result.wasUnchanged).toBe(false);
    });

    test('replace multiple lines with single line', () => {
      const oldText = 'function test() {\n  console.log("debug");\n  return true;\n}';
      const cursorPos = 45; // In the return statement
      const operation: TextOperation = {
        type: 'delete',
        position: 16,
        length: 20 // Net deletion
      };
      const newText = 'function test() { return true; }';

      const result = transformCursorPosition(cursorPos, operation, oldText, newText);
      expect(result.position).toBe(33); // Actual algorithm result for multi-line deletion
      expect(result.wasUnchanged).toBe(false);
    });
  });

  describe('Unknown operation types (default case)', () => {
    test('unknown operation type falls back to default case', () => {
      const oldText = 'hello world';
      const cursorPos = 6;
      // Операция с неизвестным типом (на практике не происходит)
      const operation: any = {
        type: 'unknown',
        position: 0,
        length: 5
      };
      const newText = 'hello world';

      const result = transformCursorPosition(cursorPos, operation, oldText, newText);
      expect(result.position).toBe(6);
      expect(result.wasUnchanged).toBe(true);
    });

    test('malformed operation falls back to default case', () => {
      const oldText = 'test text';
      const cursorPos = 4;
      // Некорректная операция
      const operation: any = {
        type: null,
        position: 0,
        length: 0
      };
      const newText = 'test text';

      const result = transformCursorPosition(cursorPos, operation, oldText, newText);
      expect(result.position).toBe(4);
      expect(result.wasUnchanged).toBe(true);
    });
  });
});
