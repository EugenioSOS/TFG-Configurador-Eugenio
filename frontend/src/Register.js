import React, { useState } from 'react';
import { Button, TextField, Box, Typography, Link, Alert } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import api from './api';

const Register = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);
  const [cargando, setCargando] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async () => {
    setError('');
    if (!username || !email || !password) { setError('Rellena todos los campos'); return; }
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return; }
    setCargando(true);
    try {
      await api.post('/register', { username, email, password });
      setOk(true);
      setTimeout(() => navigate('/'), 1200); // vuelve al login
    } catch (err) {
      setError(err.response?.data?.error || 'Error al registrar');
    } finally {
      setCargando(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, p: 3, maxWidth: 360, mx: 'auto', mt: 6 }}>
      <Typography variant="h5">Crear cuenta</Typography>

      {error && <Alert severity="error" sx={{ width: '100%' }}>{error}</Alert>}
      {ok && <Alert severity="success" sx={{ width: '100%' }}>¡Cuenta creada! Redirigiendo…</Alert>}

      <TextField label="Usuario" value={username} onChange={(e) => setUsername(e.target.value)} fullWidth />
      <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth />
      <TextField label="Contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} fullWidth />

      <Button onClick={handleRegister} variant="contained" fullWidth disabled={cargando}>
        {cargando ? 'Creando…' : 'Registrarse'}
      </Button>

      <Typography variant="body2">
        ¿Ya tienes cuenta?{' '}
        <Link component="button" onClick={() => navigate('/')}>Inicia sesión</Link>
      </Typography>
    </Box>
  );
};

export default Register;