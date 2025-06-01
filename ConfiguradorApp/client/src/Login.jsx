import React, { useState, useContext } from 'react';
import { Typography, Box, TextField, Button } from '@mui/material';
import { AuthContext } from './AuthContext';

function Login() {
  const [, setToken] = useContext(AuthContext);
  const [form, setForm] = useState({
    username: '',
    password: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await fetch('http://localhost:5000/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(form),
    });

    const data = await res.json();

    if (data.token) {
      console.log('🔐 Token recibido:', data.token);
      setToken(data.token);
    } else {
      alert('Error al iniciar sesión');
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ my: 2 }}>
      <Typography variant="h6">Iniciar sesión</Typography>
      <TextField
        fullWidth
        label="Usuario"
        margin="normal"
        value={form.username}
        onChange={e => setForm({ ...form, username: e.target.value })}
      />
      <TextField
        fullWidth
        label="Contraseña"
        type="password"
        margin="normal"
        value={form.password}
        onChange={e => setForm({ ...form, password: e.target.value })}
      />
      <Button variant="contained" type="submit">Entrar</Button>
    </Box>
  );
}

export default Login;
