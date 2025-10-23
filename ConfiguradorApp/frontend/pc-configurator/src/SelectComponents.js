import React, { useState } from 'react';
import {
  Container, Typography, FormControl, Select, MenuItem,
  InputLabel, Button, Box, Paper, Avatar, Dialog, DialogTitle,
  DialogContent, DialogActions, Link, List, ListItem, ListItemText, Divider
} from '@mui/material';
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

const SelectComponents = () => {
  const navigate = useNavigate();

  const stored = localStorage.getItem('configurations');
  const parsed = stored ? JSON.parse(stored) : [];

  const [selectedConfigs, setSelectedConfigs] = useState(parsed);

  // NUEVO: estados para el resumen (ahora por categoría con top 5)
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryTitle, setSummaryTitle] = useState('Resumen de compra');
  // Estructura: [{ label: 'CPU', options: [{name, price, url}], categoryKey: 'cpu' }, ...]
  const [summaryByCategory, setSummaryByCategory] = useState([]);

  const getComponentsByCategory = (key) => {
    const categoryLabel = categoryMap[key];
    const allComponents = parsed.flatMap(config => Object.values(config));
    const filtered = allComponents.filter(comp =>
      comp &&
      comp.category &&
      comp.category.toLowerCase().trim() === categoryLabel.toLowerCase().trim()
    );
    const unique = filtered.filter(
      (comp, index, self) => self.findIndex(c => c.id === comp.id) === index
    );
    return unique;
  };

  const handleChange = (index, e) => {
    const { name, value } = e.target;
    const updated = [...selectedConfigs];

    const options = getComponentsByCategory(name);
    const selected = options.find(comp => comp.id === value);

    if (selected) {
      updated[index][name] = selected;
      setSelectedConfigs(updated);
    }
  };

  const calculateTotal = (config) => {
    return Object.values(config)
      .filter(c => c && c.price !== undefined && c.price !== null)
      .reduce((sum, comp) => sum + Number(comp.price), 0);
  };

  const buildPurchaseLink = (comp) => {
    if (!comp) return '';
    if (comp.buy_url) return comp.buy_url;
    const q = encodeURIComponent(`${comp.name} comprar`);
    return `https://www.google.com/search?q=${q}`;
  };

  // NUEVO: genera Top 5 por categoría (precio ascendente)
  const buildTop5PerCategory = () => {
    return Object.keys(categoryMap).map((key) => {
      const label = categoryMap[key];
      const pool = getComponentsByCategory(key)
        .filter(c => c && c.price !== undefined && c.price !== null)
        .sort((a, b) => Number(a.price) - Number(b.price))
        .slice(0, 5);

      const options = pool.map(c => ({
        name: c.name,
        price: Number(c.price) || 0,
        url: buildPurchaseLink(c)
      }));

      return { label, options, categoryKey: key };
    });
  };

  // NUEVO: al confirmar, mostrar Top 5 por cada categoría
  const handleConfirmConfig = (index) => {
    setSummaryTitle(`Top 5 para compra — Configuración ${index + 1}`);
    setSummaryByCategory(buildTop5PerCategory());
    setSummaryOpen(true);
  };

  const handleOpenAll = () => {
    // Abre todos los enlaces (5 por categoría). Puede requerir permitir pop-ups en el navegador.
    summaryByCategory.forEach(cat => {
      cat.options.forEach(opt => {
        if (opt.url) window.open(opt.url, '_blank', 'noopener,noreferrer');
      });
    });
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
      <Typography variant="h4" gutterBottom>Selecciona tus configuraciones</Typography>

      <Box display="flex" flexWrap="wrap" gap={3}>
        {selectedConfigs.map((config, index) => {
          const total = calculateTotal(config);

          return (
            <Paper key={index} elevation={3} sx={{ p: 3, flex: 1, minWidth: 320 }}>
              <Typography variant="h6" gutterBottom>Configuración {index + 1}</Typography>

              {Object.keys(categoryMap).map(key => (
                <FormControl key={key} fullWidth margin="normal">
                  <InputLabel id={`${key}-label-${index}`}>{categoryMap[key]}</InputLabel>
                  <Select
                    labelId={`${key}-label-${index}`}
                    name={key}
                    value={config[key]?.id || ''}
                    onChange={(e) => handleChange(index, e)}
                  >
                    {getComponentsByCategory(key).map(comp => (
                      <MenuItem key={comp.id} value={comp.id}>
                        <Box display="flex" alignItems="center" gap={1}>
                          {comp.image_url && (
                            <Avatar src={comp.image_url} alt={comp.name} sx={{ width: 24, height: 24 }} />
                          )}
                          {comp.name} - ${comp.price}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ))}

              <Typography>Total: ${total.toFixed(2)}</Typography>

              <Box mt={2}>
                <Button variant="contained" fullWidth onClick={() => handleConfirmConfig(index)}>
                  Confirmar Configuración {index + 1}
                </Button>
              </Box>
            </Paper>
          );
        })}
      </Box>

      <Button onClick={() => navigate(-1)} variant="outlined" sx={{ mt: 3 }}>
        Volver atrás
      </Button>

      {/* Dialog con Top 5 por categoría */}
      <Dialog open={summaryOpen} onClose={() => setSummaryOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{summaryTitle}</DialogTitle>
        <DialogContent dividers>
          {summaryByCategory.map((cat, i) => (
            <Box key={cat.categoryKey} sx={{ mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                {cat.label}
              </Typography>
              <List dense>
                {cat.options.map((opt, idx) => (
                  <ListItem key={`${cat.categoryKey}-${idx}`} disableGutters>
                    <ListItemText
                      primary={`${idx + 1}. ${opt.name}`}
                      secondary={
                        <>
                          Precio: ${opt.price.toFixed(2)} —{' '}
                          <Link href={opt.url} target="_blank" rel="noopener noreferrer">
                            Comprar
                          </Link>
                        </>
                      }
                    />
                  </ListItem>
                ))}
              </List>
              {i < summaryByCategory.length - 1 && <Divider sx={{ mt: 1 }} />}
            </Box>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleOpenAll}>Abrir todos</Button>
          <Button onClick={() => setSummaryOpen(false)} variant="contained">Cerrar</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default SelectComponents;
