import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import React from 'react';
import Login from './Login';
import Register from './Register';
import QuestionForm from './QuestionForm';
import ConfiguradorSimple from './configuradorsimple';
import ConfiguradorAvanzado from './configuradoravanzado';
import MisPresupuestos from './mispresupuestos';

// Protege rutas: si no hay token, manda al login.
const Privada = ({ children }) => {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/" replace />;
};

const App = () => {
  const handleLogin = (token) => {
    localStorage.setItem('token', token);
  };

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login onLogin={handleLogin} />} />
        <Route path="/register" element={<Register />} />

        <Route path="/questions" element={<Privada><QuestionForm /></Privada>} />
        <Route path="/configurador-simple" element={<Privada><ConfiguradorSimple /></Privada>} />
        <Route path="/configurador-avanzado" element={<Privada><ConfiguradorAvanzado /></Privada>} />
        <Route path="/mis-presupuestos" element={<Privada><MisPresupuestos /></Privada>} />

        {}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};

export default App;