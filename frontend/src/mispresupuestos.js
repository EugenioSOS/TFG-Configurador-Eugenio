import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Card, CardContent, Button, Chip, Divider,
  CircularProgress, Alert, Accordion, AccordionSummary, AccordionDetails,
  List, ListItem, ListItemText, IconButton,
} from '@mui/material';
import BarraSuperior from './barrasuperior';
import api from './api';
import { useNavigate } from 'react-router-dom';

const MisPresupuestos = () => {
  const navigate = useNavigate();
  const [builds, setBuilds] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = async () => {
    setCargando(true);
    try {
      const res = await api.get('/builds/mis-builds');
      setBuilds(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cargar tus presupuestos');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const editar = (b) => {
    const componentes = {};
    b.piezas.forEach((p) => { if (p.tipo && p.id) componentes[p.tipo] = p.id; });
    localStorage.setItem('editarBuild', JSON.stringify({ componentes, buildId: b.id }));
    if (b.uso) localStorage.setItem('uso', b.uso);
    if (b.presupuesto) localStorage.setItem('presupuesto', b.presupuesto);
    navigate('/configurador-avanzado');
  };

  const borrar = async (id) => {
    if (!window.confirm('¿Borrar esta configuración?')) return;
    try {
      await api.delete(`/builds/${id}`);
      setBuilds((prev) => prev.filter((b) => b.id !== id));
    } catch (err) {
      alert(err.response?.data?.error || 'Error al borrar');
    }
  };

  return (
    <Box>
      <BarraSuperior />
      <Box sx={{ maxWidth: 800, mx: 'auto', p: 2 }}>
        <Typography variant="h4" gutterBottom>Mis presupuestos</Typography>

        {cargando && <Box sx={{ textAlign: 'center', mt: 4 }}><CircularProgress /></Box>}
        {error && <Alert severity="error">{error}</Alert>}
        {!cargando && !error && builds.length === 0 && (
          <Alert severity="info">Todavía no tienes configuraciones guardadas.</Alert>
        )}

        {builds.map((b) => {
          const diferencia = (b.total_actual - b.total_guardado).toFixed(2);
          return (
            <Card key={b.id} variant="outlined" sx={{ mb: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Typography variant="h6">{b.nombre}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {b.uso ? `Uso: ${b.uso} · ` : ''}{new Date(b.creado_en).toLocaleDateString('es-ES')}
                    </Typography>
                  </Box>
                  <Box><Button size="small" onClick={() => editar(b)} sx={{ mr: 1 }}>Editar</Button><Button color="error" size="small" onClick={() => borrar(b.id)}>Borrar</Button></Box>
                </Box>

                <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                  <Chip label={`Cuando la guardaste: ${b.total_guardado} €`} size="small" />
                  <Chip label={`Precio hoy: ${b.total_actual} €`} color="primary" size="small" />
                  {Number(diferencia) !== 0 && (
                    <Chip
                      label={`${diferencia > 0 ? '+' : ''}${diferencia} €`}
                      color={diferencia > 0 ? 'error' : 'success'}
                      size="small"
                    />
                  )}
                </Box>

                <Accordion sx={{ mt: 2, boxShadow: 'none' }}>
                  <AccordionSummary>Ver componentes ({b.piezas.length})</AccordionSummary>
                  <AccordionDetails>
                    <List dense>
                      {b.piezas.map((p, i) => (
                        <ListItem key={i} secondaryAction={
                          p.url && <Button size="small" href={p.url} target="_blank">Tienda</Button>
                        }>
                          <ListItemText
                            primary={`${p.tipo?.toUpperCase()}: ${p.nombre}`}
                            secondary={`Guardado: ${p.precio_guardado ?? '?'} € · Hoy: ${p.precio_actual ?? '?'} €`}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </AccordionDetails>
                </Accordion>
              </CardContent>
            </Card>
          );
        })}
      </Box>
    </Box>
  );
};

export default MisPresupuestos;