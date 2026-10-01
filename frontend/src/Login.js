import React, { useState } from 'react';
import { Button, TextField, Box, Typography, Link, Alert } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import api from './api';

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async () => {
    setError('');
    if (!username || !password) { setError('Introduce usuario y contraseña'); return; }
    setCargando(true);
    try {
      const res = await api.post('/login', { username, password });
      localStorage.setItem('token', res.data.token);
      // Nueva sesión: limpiar el flujo anterior para empezar en blanco.
      localStorage.removeItem('uso');
      localStorage.removeItem('presupuesto');
      localStorage.removeItem('preferencias');
      localStorage.removeItem('editarBuild');
      if (onLogin) onLogin(res.data.token);
      navigate('/questions');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al iniciar sesión');
    } finally {
      setCargando(false);
    }
  };

  const onKeyDown = (e) => { if (e.key === 'Enter') handleLogin(); };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, p: 3, maxWidth: 360, mx: 'auto', mt: 6 }}>
      <img src="/pc_configurator.png" alt="Logo" style={{ width: 100, height: 'auto' }} />
      <Typography variant="h6">Iniciar sesión</Typography>

      {error && <Alert severity="error" sx={{ width: '100%' }}>{error}</Alert>}

      <TextField
        label="Usuario"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        onKeyDown={onKeyDown}
        fullWidth
      />
      <TextField
        label="Contraseña"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={onKeyDown}
        fullWidth
      />

      <Button onClick={handleLogin} variant="contained" fullWidth disabled={cargando}>
        {cargando ? 'Entrando…' : 'Entrar'}
      </Button>

      <Typography variant="body2">
        ¿No tienes cuenta?{' '}
        <Link component="button" onClick={() => navigate('/register')}>Regístrate</Link>
      </Typography>
    </Box>
  );
};

export default Login;