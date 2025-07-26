import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './store';
import { HomePage } from './pages/HomePage';
import { RoomPage } from './pages/RoomPage';
import './App.css';

function App() {
  return (
    <Provider store={store}>
      <Router>
        <div className="App">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/room/:roomId" element={<RoomPage />} />
          </Routes>
        </div>
      </Router>
    </Provider>
  );
}

export default App;
