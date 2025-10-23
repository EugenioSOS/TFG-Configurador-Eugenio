import React, { useState } from 'react';
import { Button, TextField, Box, Typography } from '@mui/material';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const QuestionForm = () => {
  const [usage, setUsage] = useState('');
  const [budget, setBudget] = useState('');
  const navigate = useNavigate();

  

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('No se encontró el token. Por favor, inicia sesión nuevamente.');
        return;
      }

      const res = await axios.post('http://localhost:5000/api/getComponents', { usage, budget }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const components = res.data;

      // Función flexible para buscar por categoría (parcial, insensible a mayúsculas)
      const findByCategory = (keyword, index = 0) => {
        const matches = components.filter(c =>
          c.category && c.category.toLowerCase().includes(keyword.toLowerCase())
        );
        return matches[index % matches.length] || null;
      };

      // Crear 3 configuraciones con componentes distintos por índice
      const configurations = [0, 1, 2].map(i => ({
        gpu: findByCategory('tarjeta', i),
        cpu: findByCategory('cpu', i),
        placa_base: findByCategory('placa', i),
        memoria: findByCategory('ram', i),
        almacenamiento: findByCategory('almacenamiento', i),
        disipador: findByCategory('disipador', i),
        fuente_alimentacion: findByCategory('fuente', i),
        caja: findByCategory('caja', i),
      }));

      localStorage.setItem('configurations', JSON.stringify(configurations));
      navigate('/select-components');

    } catch (error) {
      console.error('Error al obtener los componentes:', error);
      alert('Error al obtener los componentes');
    }
  };
  const handleGoAdvanced = () => {
    navigate('/advanced-configuration');
  };

  return (
    <Box>
      <Typography variant="h6">¿Para qué usarás el PC?</Typography>
      <Button onClick={() => setUsage('gaming')}>Gaming</Button>
      <Button onClick={() => setUsage('work')}>Trabajo</Button>
      <Button onClick={() => setUsage('mixed')}>Mixto</Button>
      <Button onClick={() => setUsage('design')}>Diseño</Button>
      <Button onClick={() => setUsage('programming')}>Programación</Button>
      
      

      <Typography variant="h6" style={{ marginTop: 20 }}>¿Cuál es tu presupuesto?</Typography>
      <TextField
        type="number"
        value={budget}
        onChange={(e) => setBudget(e.target.value)}
        label="Presupuesto en €"
        fullWidth
        margin="normal"
      />

      <Button onClick={handleSubmit} variant="contained" sx={{ mt: 2 }}>
        Ver Componentes
      </Button>
      <Button onClick={handleGoAdvanced} variant="contained" color="secondary" sx={{ mt: 2, ml: 2 }}>
        Configuración Avanzada
      </Button>
      <Button onClick={() => navigate(-1)} variant="outlined" sx={{ mt: 2 }}>
        Volver atrás
      </Button>
    </Box>
  );
};

export default QuestionForm;