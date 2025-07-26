/**
 * Utility functions for transforming cursor positions during text operations
 */

export interface TextOperation {
  type: 'insert' | 'delete';
  position: number;
  length: number;
  content?: string;
}

/**
 * Get line and column from text position
 */
function getLineAndColumn(text: string, position: number) {
  const beforeCursor = text.substring(0, position);
  const lines = beforeCursor.split('\n');
  return {
    line: lines.length - 1,
    column: lines[lines.length - 1].length
  };
}

/**
 * Get position from line and column
 */
function getPositionFromLineColumn(text: string, line: number, column: number) {
  const lines = text.split('\n');
  let position = 0;

  // Add length of all previous lines
  for (let i = 0; i < line && i < lines.length; i++) {
    position += lines[i].length + 1; // +1 for newline
  }

  // Add column position on target line
  if (line < lines.length) {
    position += Math.min(column, lines[line].length);
  }


  return position;
}

/**
 * Transform cursor position based on text operation with line awareness
 * @param cursorPosition Current cursor position
 * @param operation Text operation that was performed
 * @param oldText Text before the operation
 * @param newText Text after the operation
 * @returns New cursor position or null if cursor should be hidden
 */
export function transformCursorPosition(
  cursorPosition: number,
  operation: TextOperation,
  oldText: string,
  newText: string
): { position: number | null; wasUnchanged: boolean } {
  // Get cursor's line and column in old text
  const cursorLineCol = getLineAndColumn(oldText, cursorPosition);
  const operationLineCol = getLineAndColumn(oldText, operation.position);

  // Debug logging disabled in production

  switch (operation.type) {
    case 'insert':
      const newLinesAdded = (operation.content || '').split('\n').length - 1;

      // Case 1: Insertion is on a different line than cursor
      if (operationLineCol.line !== cursorLineCol.line) {
        if (operationLineCol.line < cursorLineCol.line) {
          // Insertion is above cursor line
          if (newLinesAdded > 0) {
            // New lines added above cursor - move cursor down
            const newPosition = getPositionFromLineColumn(newText, cursorLineCol.line + newLinesAdded, cursorLineCol.column);
            return { position: newPosition, wasUnchanged: false };
          } else {
            // Text inserted above cursor without newlines - cursor moves forward by insertion length
            return { position: cursorPosition + operation.length, wasUnchanged: false };
          }
        } else {
          // Insertion is below cursor - cursor position stays exactly the same
          return { position: cursorPosition, wasUnchanged: true };
        }
      }

      // Case 2: Insertion is on the same line as cursor
      
      if (newLinesAdded > 0) {
        // Text was split into multiple lines
        if (operationLineCol.column <= cursorLineCol.column) {
          // Insertion is before cursor - cursor moves to new line
          const remainingTextAfterSplit = (operation.content || '').split('\n').pop() || '';
          const cursorNewColumn = cursorLineCol.column - operationLineCol.column + remainingTextAfterSplit.length;
          return { position: getPositionFromLineColumn(newText, cursorLineCol.line + newLinesAdded, cursorNewColumn), wasUnchanged: false };
        } else {
          // Insertion is after cursor - cursor stays on same line
          return { position: getPositionFromLineColumn(newText, cursorLineCol.line, cursorLineCol.column), wasUnchanged: false };
        }
      } else {
        // Same line, no newlines added
        if (operationLineCol.column <= cursorLineCol.column) {
          // Insertion is before cursor - move cursor forward
          const insertionLength = operation.content ? operation.content.length : operation.length;
          const newColumn = cursorLineCol.column + insertionLength;
          return { position: getPositionFromLineColumn(newText, cursorLineCol.line, newColumn), wasUnchanged: false };
        } else {
          // Insertion is after cursor - cursor stays at same column
          return { position: getPositionFromLineColumn(newText, cursorLineCol.line, cursorLineCol.column), wasUnchanged: true };
        }
      }

    case 'delete':
      const deleteEndPos = operation.position + operation.length;
      const deleteEndLineCol = getLineAndColumn(oldText, deleteEndPos);

      // If deletion is entirely before cursor line
      if (deleteEndLineCol.line < cursorLineCol.line) {
        const linesDeleted = deleteEndLineCol.line - operationLineCol.line;
        // Move cursor up by the number of lines deleted
        const newPosition = getPositionFromLineColumn(newText, cursorLineCol.line - linesDeleted, cursorLineCol.column);
        return { position: newPosition, wasUnchanged: false };
      }

      // If deletion starts before cursor line and ends on or after cursor line
      if (operationLineCol.line < cursorLineCol.line && deleteEndLineCol.line >= cursorLineCol.line) {
        // Special case: if deleting just a newline character, preserve cursor's relative position
        if (operation.length === 1 && deleteEndLineCol.line === cursorLineCol.line) {
          // Deleting newline character - cursor moves up but keeps same relative column position
          const cursorColumnPosition = cursorLineCol.column;
          return { position: operation.position + cursorColumnPosition, wasUnchanged: false };
        }
        // Cursor line was affected, move to deletion start
        return { position: operation.position, wasUnchanged: false };
      }

      // If deletion is on the same line as cursor
      if (operationLineCol.line === cursorLineCol.line && deleteEndLineCol.line === cursorLineCol.line) {
        // Deletion is entirely on the same line as cursor
        if (operation.position + operation.length <= cursorPosition) {
          // Deletion is entirely before cursor - move cursor back by the length of deleted text
          return { position: cursorPosition - operation.length, wasUnchanged: false };
        }

        if (operation.position < cursorPosition && operation.position + operation.length > cursorPosition) {
          // Deletion includes cursor position - move cursor to deletion start
          return { position: operation.position, wasUnchanged: false };
        }

        // Deletion is entirely after cursor - cursor stays at same column
        return { position: getPositionFromLineColumn(newText, cursorLineCol.line, cursorLineCol.column), wasUnchanged: true };
      }

      // If deletion is on a different line (above or below cursor) and no lines deleted
      if (operationLineCol.line !== cursorLineCol.line && deleteEndLineCol.line !== cursorLineCol.line) {
        const linesDeleted = deleteEndLineCol.line - operationLineCol.line;
        if (linesDeleted === 0) {
          // Text deleted on different line without deleting lines - cursor position stays exactly the same
          return { position: cursorPosition, wasUnchanged: true }; // Return original position unchanged
        }
      }
      
      // If deletion is after cursor, position stays the same
      return { position: cursorPosition, wasUnchanged: true };

    default:
      return { position: cursorPosition, wasUnchanged: true };
  }
}

/**
 * Calculate text operation between old and new text
 * @param oldText Previous text content
 * @param newText New text content
 * @param changePosition Position where change started (from textarea selectionStart)
 * @returns Text operation or null if no change detected
 */
export function calculateTextOperation(
  oldText: string,
  newText: string,
  changePosition: number
): TextOperation | null {
  if (oldText === newText) {
    return null;
  }

  // Find the common prefix and suffix
  let prefixLength = 0;
  while (
    prefixLength < oldText.length &&
    prefixLength < newText.length &&
    oldText[prefixLength] === newText[prefixLength]
  ) {
    prefixLength++;
  }

  let suffixLength = 0;
  while (
    suffixLength < oldText.length - prefixLength &&
    suffixLength < newText.length - prefixLength &&
    oldText[oldText.length - 1 - suffixLength] === newText[newText.length - 1 - suffixLength]
  ) {
    suffixLength++;
  }

  const oldMiddle = oldText.slice(prefixLength, oldText.length - suffixLength);
  const newMiddle = newText.slice(prefixLength, newText.length - suffixLength);

  if (oldMiddle.length === 0 && newMiddle.length > 0) {
    // Insertion
    return {
      type: 'insert',
      position: prefixLength,
      length: newMiddle.length,
      content: newMiddle,
    };
  } else if (oldMiddle.length > 0 && newMiddle.length === 0) {
    // Deletion
    return {
      type: 'delete',
      position: prefixLength,
      length: oldMiddle.length,
    };
  } else if (oldMiddle.length > 0 && newMiddle.length > 0) {
    // Replacement - for cursor transformation, treat as insert if net positive change
    const netChange = newMiddle.length - oldMiddle.length;
    if (netChange > 0) {
      // More text added than removed - treat as insertion
      return {
        type: 'insert',
        position: prefixLength,
        length: netChange,
        content: newMiddle,
      };
    } else if (netChange < 0) {
      // More text removed than added - treat as deletion
      return {
        type: 'delete',
        position: prefixLength,
        length: -netChange,
      };
    }
    // If same length, no cursor transformation needed
    return null;
  }

  return null;
}

/**
 * Transform multiple cursor positions based on a text operation
 * @param cursors Array of cursor positions
 * @param operation Text operation
 * @param oldText Text before the operation
 * @param newText Text after the operation
 * @returns Array of transformed cursor positions (null values indicate hidden cursors)
 */
export function transformMultipleCursors(
  cursors: Array<{ userId: string; position: number }>,
  operation: TextOperation,
  oldText: string,
  newText: string
): Array<{ userId: string; position: number | null; wasUnchanged: boolean }> {
  return cursors.map(cursor => {
    const result = transformCursorPosition(cursor.position, operation, oldText, newText);
    return {
      userId: cursor.userId,
      position: result.position,
      wasUnchanged: result.wasUnchanged,
    };
  });
}
