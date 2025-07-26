import React from 'react';
import { Link } from 'react-router-dom';
import './NotFoundPage.css';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="not-found-page">
      <div className="not-found-container">
        <div className="not-found-content">
          <h1 className="not-found-title">404</h1>
          <h2 className="not-found-subtitle">Страница не найдена</h2>
          <p className="not-found-description">
            К сожалению, запрашиваемая страница не существует или была удалена.
          </p>
          <div className="not-found-actions">
            <Link to="/welcome" className="btn btn-primary">
              Создать новую комнату
            </Link>
          </div>
        </div>
        <div className="not-found-illustration">
          <div className="code-block">
            <div className="code-line">
              <span className="code-keyword">if</span>
              <span className="code-text"> (page.exists()) </span>
              <span className="code-bracket">{'{'}</span>
            </div>
            <div className="code-line code-indent">
              <span className="code-text">return page;</span>
            </div>
            <div className="code-line">
              <span className="code-bracket">{'}'}</span>
              <span className="code-keyword"> else </span>
              <span className="code-bracket">{'{'}</span>
            </div>
            <div className="code-line code-indent">
              <span className="code-comment">// Упс! 404</span>
            </div>
            <div className="code-line code-indent">
              <span className="code-keyword">throw new</span>
              <span className="code-text"> PageNotFoundError();</span>
            </div>
            <div className="code-line">
              <span className="code-bracket">{'}'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};