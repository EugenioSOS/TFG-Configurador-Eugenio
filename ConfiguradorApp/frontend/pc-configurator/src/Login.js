import React, { useState } from 'react';
import { Button, TextField, Box, Typography } from '@mui/material';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      const res = await axios.post('http://localhost:5000/api/login', { username, password });
      localStorage.setItem('token', res.data.token);
      onLogin(res.data.token);  // Guardamos el token en el estado del componente superior
      navigate('/questions'); // Redirige a la pantalla de preguntas
    } catch (error) {
      setError('Error al iniciar sesión');
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: 2 }}>
       <img src="/pc_configurator.png" alt="Logo" style={{ width: 100, height: 'auto' }} />
      <Typography variant="h6">Iniciar sesión</Typography>
      <TextField
        label="Usuario"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        halfWidth
      />
      <TextField
        label="Contraseña"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        halfWidth
      />
      {error && <Typography color="error">{error}</Typography>}
      <Button onClick={handleLogin} variant="contained">Entrar</Button>
    </Box>
  );
};

export default Login;