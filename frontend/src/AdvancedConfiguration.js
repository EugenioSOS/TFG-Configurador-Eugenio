import React, { useState } from 'react';
import { Container, Typography, FormControl, Select, MenuItem, InputLabel, Button, Box, Paper, Avatar } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const categoryMap = {
  gpu: 'Tarjeta Gráfica',
  cpu: 'CPU',
  placa_base: 'Placa Base',
  memoria: 'Memoria RAM',
  almacenamiento: 'Almacenamiento',
  disipador: 'Disipador',
  fuente_alimentacion: 'Fuente de Alimentación',
  caja: 'Caja'
};

const AdvancedConfiguration = () => {
  const navigate = useNavigate();

  // Extrae y parsea configuraciones desde localStorage (solo para tener opciones disponibles)
  const stored = localStorage.getItem('configurations');
  const parsed = stored ? JSON.parse(stored) : [];

  // Estado inicial vacío (ninguna opción seleccionada)
  const emptyConfig = Object.keys(categoryMap).reduce((acc, key) => {
    acc[key] = null;
    return acc;
  }, {});

  const [selectedConfig, setSelectedConfig] = useState(emptyConfig);

  // Extrae todos los componentes únicos por categoría de lo que hay en localStorage
  const getComponentsByCategory = (key) => {
    const categoryLabel = categoryMap[key];
    const allComponents = parsed.flatMap(config => Object.values(config));
    const filtered = allComponents.filter(
      comp =>
        comp &&
        comp.category &&
        comp.category.toLowerCase().trim() === categoryLabel.toLowerCase().trim()
    );

    // Elimina duplicados por ID
    return filtered.filter(
      (comp, index, self) => self.findIndex(c => c.id === comp.id) === index
    );
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const options = getComponentsByCategory(name);
    const selected = options.find(comp => comp.id === value) || null;

    setSelectedConfig(prev => ({
      ...prev,
      [name]: selected
    }));
  };

  if (!Array.isArray(parsed) || parsed.length === 0) {
    return (
      <Container>
        <Typography variant="h6">
          No se han cargado configuraciones. Por favor, vuelve al inicio.
        </Typography>
        <Button variant="contained" onClick={() => navigate('/')}>
          Ir al inicio
        </Button>
      </Container>
    );
  }

  return (
    <Container>
      <Typography variant="h4" gutterBottom>
        Configura tu ordenador
      </Typography>

      <Paper elevation={3} sx={{ p: 3, minWidth: 320 }}>
        <Typography variant="h6" gutterBottom>
          Configuración Personalizada
        </Typography>

        {Object.keys(categoryMap).map(key => (
          <FormControl key={key} fullWidth margin="normal">
            <InputLabel id={`${key}-label`}>{categoryMap[key]}</InputLabel>
            <Select
              labelId={`${key}-label`}
              name={key}
              value={selectedConfig[key]?.id || ''} // empieza vacío
              onChange={handleChange}
            >
              {getComponentsByCategory(key).map(comp => (
                <MenuItem key={comp.id} value={comp.id}>
                  <Box display="flex" alignItems="center" gap={1}>
                    {comp.image_url && (
                      <Avatar
                        src={comp.image_url}
                        alt={comp.name}
                        sx={{ width: 24, height: 24 }}
                      />
                    )}
                    {comp.name} - ${comp.price}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        ))}

        <Box mt={2}>
          <Button variant="contained" fullWidth>
            Confirmar Configuración
          </Button>
        </Box>
      </Paper>

      <Button onClick={() => navigate(-1)} variant="outlined" sx={{ mt: 3 }}>
        Volver atrás
      </Button>
    </Container>
  );
};

export default AdvancedConfiguration;