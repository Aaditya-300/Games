import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useSocketEvents } from './hooks/useSocket';
import LandingPage from './pages/LandingPage';
import LobbyPage from './pages/LobbyPage';
import GamePage from './pages/GamePage';
import SpectatorPage from './pages/SpectatorPage';
import TDLobbyPage from './pages/TDLobbyPage';
import TDGamePage from './pages/TDGamePage';
import SkLobbyPage from './pages/SkLobbyPage';
import SkGamePage from './pages/SkGamePage';
import ToastContainer from './components/shared/Toast';
import './styles/global.css';
import './styles/animations.css';

function AppInner() {
  useSocketEvents();

  return (
    <>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/lobby" element={<LobbyPage />} />
        <Route path="/game" element={<GamePage />} />
        <Route path="/spectator" element={<SpectatorPage />} />
        <Route path="/td-lobby" element={<TDLobbyPage />} />
        <Route path="/td-game" element={<TDGamePage />} />
        <Route path="/sk-lobby" element={<SkLobbyPage />} />
        <Route path="/sk-game" element={<SkGamePage />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      <ToastContainer />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
}
