import React, { useRef } from 'react';
import './UserCursor.css';

interface UserCursorProps {
  nickname: string;
  position: number;
  code: string;
  lineHeight: number;
  charWidth: number;
  preserveVisual?: boolean;
}

export const UserCursor: React.FC<UserCursorProps> = ({ 
  nickname, 
  position, 
  code, 
  lineHeight, 
  charWidth,
  preserveVisual = false 
}) => {
  const lastValidPositionRef = useRef<{ top: number; left: number } | null>(null);
  
  const getCursorPosition = () => {
    // Ensure position is within bounds
    const safePosition = Math.max(0, Math.min(position, code.length));
    const textBeforeCursor = code.substring(0, safePosition);
    const lines = textBeforeCursor.split('\n');
    const lineNumber = lines.length - 1;
    const columnNumber = lines[lines.length - 1].length;
    
    const top = lineNumber * lineHeight + 15; // +15 for padding
    const left = columnNumber * charWidth + 15; // +15 for padding

    const currentPosition = { top, left };
    
    // If preserveVisual is true and we have a last valid position, use it to maintain visual stability
    if (preserveVisual && lastValidPositionRef.current) {
      console.log(`👁️ UserCursor ${nickname}: preserving visual position at (${lastValidPositionRef.current.top}, ${lastValidPositionRef.current.left}) instead of calculated (${top}, ${left})`);
      return lastValidPositionRef.current;
    }
    
    // Store as last valid position for potential future use
    lastValidPositionRef.current = currentPosition;
    
    return currentPosition;
  };

  const { top, left } = getCursorPosition();

  const cursorColor = `hsl(${nickname.charCodeAt(0) * 7 % 360}, 70%, 60%)`;

  return (
    <div
      className="user-cursor"
      style={{
        top: `${top}px`,
        left: `${left}px`,
        borderColor: cursorColor,
      }}
    >
      <div 
        className="cursor-label"
        style={{ backgroundColor: cursorColor }}
      >
        {nickname}
      </div>
    </div>
  );
};