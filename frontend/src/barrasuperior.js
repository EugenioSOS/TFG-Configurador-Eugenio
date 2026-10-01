import React from 'react';
import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const BarraSuperior = () => {
  const navigate = useNavigate();

  // Empezar un presupuesto NUEVO: limpia el flujo anterior para partir en blanco.
  const nuevoPresupuesto = () => {
    localStorage.removeItem('uso');
    localStorage.removeItem('presupuesto');
    localStorage.removeItem('preferencias');
    localStorage.removeItem('editarBuild');
    navigate('/questions');
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('uso');
    localStorage.removeItem('presupuesto');
    localStorage.removeItem('preferencias');
    localStorage.removeItem('editarBuild');
    navigate('/');
  };

  return (
    <AppBar position="static" sx={{ mb: 2 }}>
      <Toolbar>
        <Typography variant="h6" sx={{ flexGrow: 1, cursor: 'pointer' }} onClick={nuevoPresupuesto}>
          Configurador de PC
        </Typography>
        <Box>
          <Button color="inherit" onClick={() => navigate('/mis-presupuestos')}>Mis presupuestos</Button>
          <Button color="inherit" onClick={logout}>Cerrar sesión</Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default BarraSuperior;