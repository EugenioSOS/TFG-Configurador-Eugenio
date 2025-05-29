import React from 'react'
import { useState } from 'react'
import{ Container,Typography, Box } from '@mui/material'
import Login from './Login'
import AdminPanel from './AdminPanel';
//import AdminPanel from './AdminPanel'
function App() {
return (
  <Container maxWidth="md">
  <Box my={4}>
    <Typography variant="h4" component="h1" gutterBottom>
      Configurador de PC
    </Typography>
    <Login />
    <AdminPanel/>
    <Typography variant="subtitle1" gutterBottom>
      Bienvenido al configurador de PC. Por favor, inicia sesión para continuar.
    </Typography>
  </Box>

  </Container>
);
}

export default App
