import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { createCodeFile, clearError } from '../store/codeSlice';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { currentFile, isLoading, error } = useAppSelector((state) => state.code);

  useEffect(() => {
    const createNewRoom = async () => {
      try {
        const result = await dispatch(createCodeFile());
        if (createCodeFile.fulfilled.match(result)) {
          navigate(`/room/${result.payload.id}`);
        }
      } catch (err) {
        console.error('Failed to create room:', err);
      }
    };

    createNewRoom();
  }, [dispatch, navigate]);

  const handleClearError = () => {
    dispatch(clearError());
  };

  if (isLoading) {
    return (
      <div className="home-page">
        <div className="loading">
          <h2>Creating your coding room...</h2>
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="home-page">
        <div className="error">
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={handleClearError} className="retry-button">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="home-page">
      <div className="loading">
        <h2>Redirecting to your room...</h2>
      </div>
    </div>
  );
};