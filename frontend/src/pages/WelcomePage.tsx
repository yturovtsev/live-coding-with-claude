import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { createCodeFile, clearError } from '../store/codeSlice';
import './WelcomePage.css';
import {saveSession} from "../utils/session";

export const WelcomePage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { isLoading, error } = useAppSelector((state) => state.code);

  const [nickname, setNickname] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nickname.trim()) {
      return;
    }

    try {
      const result = await dispatch(createCodeFile());
      if (createCodeFile.fulfilled.match(result)) {
        saveSession(nickname);
        navigate(`/room/${result.payload.id}`);
      }
    } catch (err) {
      console.error('Failed to create room:', err);
    }
  };

  const handleClearError = () => {
    dispatch(clearError());
  };

  if (error) {
    return (
      <div className="welcome-page">
        <div className="welcome-container">
          <div className="error-card">
            <h2>Ошибка</h2>
            <p>{error}</p>
            <button onClick={handleClearError} className="btn btn-secondary">
              Попробовать снова
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="welcome-page">
      <div className="welcome-container">
        <div className="welcome-card">
          <div className="welcome-header">
            <h1 className="welcome-title">
              <span className="code-bracket">{'<'}</span>
              Collaborative Code Editor
              <span className="code-bracket">{'/>'}</span>
            </h1>
          </div>

          <form onSubmit={handleSubmit} className="nickname-form">
            <div className="form-group">
              <input
                id="nickname"
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Введите ваше имя..."
                className="form-input"
                maxLength={20}
                disabled={isLoading}
                autoFocus
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={!nickname.trim() || isLoading}
            >
              {isLoading ? (
                <>
                  <div className="spinner-small"></div>
                  Создание комнаты...
                </>
              ) : (
                'Создать комнату'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
