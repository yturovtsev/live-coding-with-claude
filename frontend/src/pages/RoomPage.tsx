import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { getCodeFile, clearError, resetRoomState } from '../store/codeSlice';
import { useSocket } from '../hooks/useSocket';
import { CodeEditor } from '../components/CodeEditor';
import { getSession, saveSession, updateSessionTimestamp } from '../utils/session';
import './RoomPage.css';

export const RoomPage: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { currentFile, isLoading, error, isConnected } = useAppSelector((state) => state.code);
  const { joinRoom, leaveRoom } = useSocket();

  const [nickname, setNickname] = useState('');
  const [hasJoined, setHasJoined] = useState(false);
  const [sessionLoaded, setSessionLoaded] = useState(false);

  const handleJoinRoom = useCallback(() => {
    if (roomId && isConnected) {
      const finalNickname = nickname || `User${Math.floor(Math.random() * 1000)}`;

      // Сохраняем сессию
      if (finalNickname !== nickname) {
        setNickname(finalNickname);
      }
      saveSession(finalNickname);

      joinRoom(roomId, finalNickname);
      setHasJoined(true);
    }
  }, [roomId, isConnected, nickname, joinRoom]);

  useEffect(() => {
    if (!roomId) {
      navigate('/');
      return;
    }

    // Сбрасываем состояние комнаты при загрузке
    dispatch(resetRoomState());

    const fetchRoom = async () => {
      try {
        const result = await dispatch(getCodeFile(roomId));
        if (getCodeFile.fulfilled.match(result)) {
          // console.log('Room loaded successfully:', result.payload);
        }
      } catch (err) {
        console.error('Failed to fetch room:', err);
      }
    };

    fetchRoom();
  }, [roomId, dispatch, navigate]);

  // Проверяем сессию при загрузке компонента
  useEffect(() => {
    const savedNickname = getSession();
    if (savedNickname) {
      setNickname(savedNickname);
      updateSessionTimestamp();
    }
    setSessionLoaded(true);
  }, []);

  // Автоматически присоединяемся к комнате, если есть сохраненная сессия
  useEffect(() => {
    // console.log('Auto-join check:', {
    //   sessionLoaded,
    //   nickname,
    //   isConnected,
    //   currentFile: !!currentFile,
    //   hasJoined
    // });

    // Автоджоин только если nickname был загружен из сессии, а не введен пользователем
    if (sessionLoaded && nickname && isConnected && currentFile && !hasJoined) {
      const savedNickname = getSession();
      if (savedNickname === nickname) {
        console.log('Auto-joining room with saved session');
        handleJoinRoom();
      }
    }
  }, [sessionLoaded, isConnected, currentFile, hasJoined, handleJoinRoom]);

  useEffect(() => {
    return () => {
      // console.log('Component unmounting, leaving room');
      leaveRoom();
    };
  }, []);

  // Отдельный эффект для обработки изменения комнаты
  useEffect(() => {
    setHasJoined(false);
  }, [roomId]);

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (isConnected) {
      handleJoinRoom();
    }
  };

  const handleClearError = () => {
    dispatch(clearError());
  };

  if (isLoading) {
    return (
      <div className="room-page">
        <div className="loading">
          <h2>Loading room...</h2>
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="room-page">
        <div className="error">
          <h2>Error</h2>
          <p>{error}</p>
          <div className="error-actions">
            <button onClick={handleClearError} className="retry-button">
              Try Again
            </button>
            <button onClick={() => navigate('/')} className="home-button">
              Create New Room
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentFile) {
    return (
      <div className="room-page">
        <div className="error">
          <h2>Room not found</h2>
          <p>This room may have expired or doesn't exist.</p>
          <button onClick={() => navigate('/')} className="home-button">
            Create New Room
          </button>
        </div>
      </div>
    );
  }

  if (!hasJoined) {
    return (
      <div className="room-page">
        <div className="join-form">
          <h2>Join Coding Room</h2>
          <p>Room ID: <code>{roomId}</code></p>
          {currentFile && currentFile.code && (
            <p>⚡ Code found in this room: {currentFile.code.length} characters</p>
          )}
          <form className="join-form-container" onSubmit={handleFormSubmit}>
            <div className="form-group">
              <label htmlFor="nickname">Nickname (optional 1):</label>
              <input
                type="text"
                id="nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Enter your nickname"
                maxLength={20}
                autoFocus
                autoComplete="off"
              />
            </div>
            <button
              type="submit"
              disabled={!isConnected}
              className="join-button"
            >
              {isConnected ? 'Join Room' : 'Connecting...'}
            </button>
          </form>
          <div className="connection-status">
            Status: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="room-page">
      <CodeEditor roomId={roomId!} />
    </div>
  );
};
