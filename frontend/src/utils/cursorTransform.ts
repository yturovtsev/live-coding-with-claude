export interface TextOperation {
  type: 'insert' | 'delete';
  position: number;
  length: number;
  content?: string;
}

interface LineColumn {
  line: number;
  column: number;
}

interface CursorTransformResult {
  position: number | null;
  wasUnchanged: boolean;
}

interface CursorContext {
  cursorLineCol: LineColumn;
  operationLineCol: LineColumn;
  cursorPosition: number;
  operation: TextOperation;
  oldText: string;
  newText: string;
}

function getLineAndColumn(text: string, position: number) {
  const beforeCursor = text.substring(0, position);
  const lines = beforeCursor.split('\n');
  return {
    line: lines.length - 1,
    column: lines[lines.length - 1].length
  };
}

function getPositionFromLineColumn(text: string, line: number, column: number) {
  const lines = text.split('\n');
  let position = 0;

  for (let i = 0; i < line && i < lines.length; i++) {
    position += lines[i].length + 1;
  }

  if (line < lines.length) {
    position += Math.min(column, lines[line].length);
  }

  return position;
}

function createCursorContext(
  cursorPosition: number,
  operation: TextOperation,
  oldText: string,
  newText: string
): CursorContext {
  return {
    cursorLineCol: getLineAndColumn(oldText, cursorPosition),
    operationLineCol: getLineAndColumn(oldText, operation.position),
    cursorPosition,
    operation,
    oldText,
    newText
  };
}

function unchangedResult(position: number): CursorTransformResult {
  return { position, wasUnchanged: true };
}

function changedResult(position: number | null): CursorTransformResult {
  return { position, wasUnchanged: false };
}

/**
 * Обработка операций вставки текста
 */
function handleInsertOperation(context: CursorContext): CursorTransformResult {
  const { cursorLineCol, operationLineCol, operation } = context;
  const newLinesAdded = (operation.content || '').split('\n').length - 1;

  if (operationLineCol.line !== cursorLineCol.line) {
    return handleInsertOnDifferentLine(context, newLinesAdded);
  }

  return handleInsertOnSameLine(context, newLinesAdded);
}

function handleInsertOnDifferentLine(context: CursorContext, newLinesAdded: number): CursorTransformResult {
  const { cursorLineCol, operationLineCol, cursorPosition, operation, newText } = context;

  if (operationLineCol.line < cursorLineCol.line) {
    if (newLinesAdded > 0) {
      // Добавлены новые строки выше курсора - сдвигаем курсор вниз
      const newPosition = getPositionFromLineColumn(newText, cursorLineCol.line + newLinesAdded, cursorLineCol.column);
      return changedResult(newPosition);
    } else {
      // Текст вставлен выше курсора без переносов строк
      return changedResult(cursorPosition + operation.length);
    }
  } else {
    // Вставка ниже курсора - позиция остается прежней
    return unchangedResult(cursorPosition);
  }
}

function handleInsertOnSameLine(context: CursorContext, newLinesAdded: number): CursorTransformResult {
  const { cursorLineCol, operationLineCol, operation, newText } = context;

  if (newLinesAdded > 0) {
    // Текст был разделен на несколько строк
    if (operationLineCol.column <= cursorLineCol.column) {
      // Вставка до курсора - курсор переходит на новую строку
      const remainingTextAfterSplit = (operation.content || '').split('\n').pop() || '';
      const cursorNewColumn = cursorLineCol.column - operationLineCol.column + remainingTextAfterSplit.length;
      const newPosition = getPositionFromLineColumn(newText, cursorLineCol.line + newLinesAdded, cursorNewColumn);
      return changedResult(newPosition);
    } else {
      // Вставка после курсора - курсор остается на той же строке
      const newPosition = getPositionFromLineColumn(newText, cursorLineCol.line, cursorLineCol.column);
      return changedResult(newPosition);
    }
  } else {
    // Та же строка, переносы строк не добавлены
    if (operationLineCol.column <= cursorLineCol.column) {
      // Вставка до курсора - сдвигаем курсор вперед
      const insertionLength = operation.content ? operation.content.length : operation.length;
      const newColumn = cursorLineCol.column + insertionLength;
      const newPosition = getPositionFromLineColumn(newText, cursorLineCol.line, newColumn);
      return changedResult(newPosition);
    } else {
      // Вставка после курсора - курсор остается в той же колонке
      const newPosition = getPositionFromLineColumn(newText, cursorLineCol.line, cursorLineCol.column);
      return unchangedResult(newPosition);
    }
  }
}

/**
 * Обработка операций удаления текста
 */
function handleDeleteOperation(context: CursorContext): CursorTransformResult {
  const { cursorLineCol, operationLineCol, cursorPosition, operation, oldText } = context;
  const deleteEndPos = operation.position + operation.length;
  const deleteEndLineCol = getLineAndColumn(oldText, deleteEndPos);

  if (deleteEndLineCol.line < cursorLineCol.line) {
    return handleDeleteBeforeCursor(context, deleteEndLineCol);
  }

  if (operationLineCol.line < cursorLineCol.line && deleteEndLineCol.line >= cursorLineCol.line) {
    return handleDeleteSpanningCursorLine(context, deleteEndLineCol);
  }

  if (operationLineCol.line === cursorLineCol.line && deleteEndLineCol.line === cursorLineCol.line) {
    return handleDeleteOnSameLine(context);
  }

  if (operationLineCol.line !== cursorLineCol.line && deleteEndLineCol.line !== cursorLineCol.line) {
    return handleDeleteOnDifferentLine(context, deleteEndLineCol);
  }

  return unchangedResult(cursorPosition);
}

function handleDeleteBeforeCursor(context: CursorContext, deleteEndLineCol: LineColumn): CursorTransformResult {
  const { cursorLineCol, operationLineCol, newText } = context;
  const linesDeleted = deleteEndLineCol.line - operationLineCol.line;
  const newPosition = getPositionFromLineColumn(newText, cursorLineCol.line - linesDeleted, cursorLineCol.column);
  return changedResult(newPosition);
}

function handleDeleteSpanningCursorLine(context: CursorContext, deleteEndLineCol: LineColumn): CursorTransformResult {
  const { cursorLineCol, operation } = context;
  
  // Специальный случай: удаление только символа перевода строки
  if (operation.length === 1 && deleteEndLineCol.line === cursorLineCol.line) {
    const cursorColumnPosition = cursorLineCol.column;
    return changedResult(operation.position + cursorColumnPosition);
  }
  
  // Строка курсора затронута - перемещаем к началу удаления
  return changedResult(operation.position);
}

function handleDeleteOnSameLine(context: CursorContext): CursorTransformResult {
  const { cursorLineCol, cursorPosition, operation, newText } = context;

  if (operation.position + operation.length <= cursorPosition) {
    // Удаление полностью до курсора
    return changedResult(cursorPosition - operation.length);
  }

  if (operation.position < cursorPosition && operation.position + operation.length > cursorPosition) {
    // Удаление включает позицию курсора
    return changedResult(operation.position);
  }

  // Удаление полностью после курсора
  const newPosition = getPositionFromLineColumn(newText, cursorLineCol.line, cursorLineCol.column);
  return unchangedResult(newPosition);
}

function handleDeleteOnDifferentLine(context: CursorContext, deleteEndLineCol: LineColumn): CursorTransformResult {
  const { cursorPosition, operationLineCol } = context;
  const linesDeleted = deleteEndLineCol.line - operationLineCol.line;
  
  if (linesDeleted === 0) {
    return unchangedResult(cursorPosition);
  }
  
  return unchangedResult(cursorPosition);
}

/**
 * Трансформация позиции курсора с учетом операций редактирования текста
 * @param cursorPosition Текущая позиция курсора
 * @param operation Операция редактирования текста
 * @param oldText Текст до операции
 * @param newText Текст после операции
 * @returns Новая позиция курсора или null если курсор должен быть скрыт
 */
export function transformCursorPosition(
  cursorPosition: number,
  operation: TextOperation,
  oldText: string,
  newText: string
): CursorTransformResult {
  const context = createCursorContext(cursorPosition, operation, oldText, newText);
  switch (operation.type) {
    case 'insert':
      return handleInsertOperation(context);
    
    case 'delete':
      return handleDeleteOperation(context);
    
    default:
      return unchangedResult(cursorPosition);
  }
}

/**
 * Вычисление операции редактирования между старым и новым текстом
 */
export function calculateTextOperation(
  oldText: string,
  newText: string,
  changePosition: number
): TextOperation | null {
  if (oldText === newText) {
    return null;
  }

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
    return {
      type: 'insert',
      position: prefixLength,
      length: newMiddle.length,
      content: newMiddle,
    };
  } else if (oldMiddle.length > 0 && newMiddle.length === 0) {
    return {
      type: 'delete',
      position: prefixLength,
      length: oldMiddle.length,
    };
  } else if (oldMiddle.length > 0 && newMiddle.length > 0) {
    const netChange = newMiddle.length - oldMiddle.length;
    if (netChange > 0) {
      return {
        type: 'insert',
        position: prefixLength,
        length: netChange,
        content: newMiddle,
      };
    } else if (netChange < 0) {
      return {
        type: 'delete',
        position: prefixLength,
        length: -netChange,
      };
    }
    return null;
  }

  return null;
}

/**
 * Трансформация позиций нескольких курсоров
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
