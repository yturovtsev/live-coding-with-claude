import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { updateCode, updateUserCursor } from '../store/codeSlice';
import { useSocket } from '../hooks/useSocket';
import { debounce } from '../utils/debounce';
import { UserCursor } from './UserCursor';
import { calculateTextOperation } from '../utils/cursorTransform';
import './CodeEditor.css';

interface CodeEditorProps {
  roomId: string;
}

const SUPPORTED_LANGUAGES = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
  { value: 'css', label: 'CSS' },
  { value: 'html', label: 'HTML' },
  { value: 'json', label: 'JSON' },
];

// Константы для размеров шрифта
const LINE_HEIGHT = 21; // 14px * 1.5 line-height
const CHAR_WIDTH = 8.4; // Примерная ширина моноширинного символа

export const CodeEditor: React.FC<CodeEditorProps> = ({ roomId }) => {
  const dispatch = useAppDispatch();
  const { currentFile, users, isInRoom, currentUserId } = useAppSelector((state) => state.code);
  const { sendCodeUpdate, sendLanguageChange, sendCursorUpdate } = useSocket();

  const [code, setCode] = useState(currentFile?.code || '');
  const [language, setLanguage] = useState(currentFile?.language || 'javascript');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const debouncedCodeUpdate = useCallback(
    debounce((newCode: string, currentIsInRoom: boolean) => {
      if (currentIsInRoom) {
        sendCodeUpdate(roomId, newCode);
      }
    }, 300),
    [roomId, sendCodeUpdate]
  );

  const debouncedCursorUpdate = useCallback(
    debounce((position: number, currentIsInRoom: boolean) => {
      if (currentIsInRoom) {
        sendCursorUpdate(roomId, position);
      }
    }, 300),
    [roomId, sendCursorUpdate]
  );

  useEffect(() => {
    if (currentFile) {
      setCode(currentFile.code);
      setLanguage(currentFile.language);
      // Initialize previousCode when file is loaded
      dispatch(updateCode({ code: currentFile.code, language: currentFile.language }));
    }
  }, [currentFile, dispatch]);

  const handleCodeChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newCode = event.target.value;
    const oldCode = code;
    const newCursorPosition = event.target.selectionStart;

    setCode(newCode);

    // If we're in a room, transform cursors for local changes too
    if (isInRoom && oldCode !== newCode) {
      const operation = calculateTextOperation(oldCode, newCode, 0);
      console.log('🔄 LOCAL: User typing, transforming other cursors with operation:', operation);
      console.log('🔄 LOCAL: Current user cursor position after change:', newCursorPosition);

      dispatch(updateCode({
        code: newCode,
        fromLocalUser: true,
        operation: operation || undefined
      }));
      
      // Update current user's cursor position immediately to prevent incorrect transformation
      if (currentUserId) {
        dispatch(updateUserCursor({ 
          userId: currentUserId, 
          position: newCursorPosition 
        }));
      }
    } else {
      dispatch(updateCode({ code: newCode }));
    }

    // Передаем текущее состояние isInRoom в debounced функцию
    debouncedCodeUpdate(newCode, isInRoom);
  };

  const handleLanguageChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newLanguage = event.target.value;
    setLanguage(newLanguage);
    if (isInRoom) {
      sendLanguageChange(roomId, newLanguage);
    }
  };

  const handleCursorChange = (event: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const textarea = event.currentTarget;
    const position = textarea.selectionStart;
    console.log(`Cursor position changed: ${position}, isInRoom: ${isInRoom}`);
    debouncedCursorUpdate(position, isInRoom);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Tab') {
      event.preventDefault(); // Предотвращаем стандартное поведение Tab

      const textarea = event.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const tabChar = '  '; // 2 пробела

      if (event.shiftKey) {
        // Shift+Tab - убираем отступ
        const beforeCursor = code.substring(0, start);
        const afterCursor = code.substring(end);

        // Находим начало текущей строки
        const lineStart = beforeCursor.lastIndexOf('\n') + 1;
        const currentLine = beforeCursor.substring(lineStart);

        // Если строка начинается с пробелов/табов, убираем
        if (currentLine.startsWith(tabChar)) {
          const newValue = code.substring(0, lineStart) + currentLine.substring(tabChar.length) + afterCursor;
          setCode(newValue);
          dispatch(updateCode({ code: newValue }));
          debouncedCodeUpdate(newValue, isInRoom);

          setTimeout(() => {
            const newPosition = Math.max(lineStart, start - tabChar.length);
            textarea.selectionStart = textarea.selectionEnd = newPosition;
            // Update cursor position after tab operation
            debouncedCursorUpdate(newPosition, isInRoom);
          }, 0);
        }
      } else {
        // Обычный Tab - добавляем отступ
        const newValue = code.substring(0, start) + tabChar + code.substring(end);

        setCode(newValue);
        dispatch(updateCode({ code: newValue }));
        debouncedCodeUpdate(newValue, isInRoom);

        setTimeout(() => {
          const newPosition = start + tabChar.length;
          textarea.selectionStart = textarea.selectionEnd = newPosition;
          // Update cursor position after tab operation
          debouncedCursorUpdate(newPosition, isInRoom);
        }, 0);
      }
    } else {
      // Для других клавиш обновляем позицию курсора
      handleCursorChange(event);
    }
  };

  const getCursorCoordinates = (position: number) => {
    if (!textareaRef.current) return { line: 0, column: 0 };

    const text = code.substring(0, position);
    const lines = text.split('\n');
    const line = lines.length;
    const column = lines[lines.length - 1].length + 1;

    return { line, column };
  };

  if (!isInRoom) {
    return (
      <div className="code-editor">
        <div className="editor-header">
          <div className="room-info">
            <span>⚠️ Not connected to room. Please join the room first.</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="code-editor">
      <div className="editor-header">
        <div className="language-selector">
          <label htmlFor="language">Language: </label>
          <select
            id="language"
            value={language}
            onChange={handleLanguageChange}
            className="language-select"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.value} value={lang.value}>
                {lang.label}
              </option>
            ))}
          </select>
        </div>

        <div className="room-info">
          <span>Room: {roomId}</span>
          <span>Users: {users.length}</span>
        </div>
      </div>

      <div className="editor-container">
        <textarea
          ref={textareaRef}
          value={code}
          onChange={handleCodeChange}
          onSelect={handleCursorChange}
          onKeyUp={handleCursorChange}
          onKeyDown={handleKeyDown}
          onClick={handleCursorChange}
          onFocus={handleCursorChange}
          className="code-textarea"
          placeholder="Start typing your code here..."
          spellCheck={false}
        />

        <div className="syntax-highlight-overlay">
          <SyntaxHighlighter
            language={language}
            style={vscDarkPlus}
            customStyle={{
              background: 'transparent',
              padding: 0,
              margin: 0,
              fontSize: '14px',
              fontFamily: 'monospace',
              lineHeight: '1.5',
            }}
            codeTagProps={{
              style: {
                fontFamily: 'monospace',
              },
            }}
          >
            {code || ' '}
          </SyntaxHighlighter>
        </div>

        {/* Курсоры других пользователей */}
        {(() => {
          const otherUsers = users.filter(user =>
            user.cursorPosition !== undefined &&
            user.id !== currentUserId &&
            user.cursorPosition >= 0 &&
            user.cursorPosition <= code.length
          );
          return otherUsers.map(user => (
            <UserCursor
              key={`${user.id}-${user.cursorPosition}`}
              nickname={user.nickname}
              position={user.cursorPosition!}
              code={code}
              lineHeight={LINE_HEIGHT}
              charWidth={CHAR_WIDTH}
              preserveVisual={(user as any).preserveVisual || false}
            />
          ));
        })()}
      </div>

      <div className="users-list">
        <h4>Active Users ({users.length})</h4>
        <ul>
          {users.map((user) => {
            const cursorCoords = user.cursorPosition !== undefined
              ? getCursorCoordinates(user.cursorPosition)
              : null;

            return (
              <li key={user.id}>
                {user.nickname}
                {cursorCoords && (
                  <span className="cursor-info"> (Line {cursorCoords.line}, Col {cursorCoords.column})</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};
