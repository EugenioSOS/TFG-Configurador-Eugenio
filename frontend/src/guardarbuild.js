import React, { useState } from 'react';
import {
  Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Alert,
} from '@mui/material';
import api from './api';

// Props:
//   componentes: { cpu: id, placa: id, ... }  (ids de las piezas elegidas)
//   uso, presupuesto, modo: contexto de la build
const GuardarBuild = ({ componentes, uso, presupuesto, modo }) => {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState('');
  const [mensaje, setMensaje] = useState(null);   // { tipo, texto }
  const [guardando, setGuardando] = useState(false);

  const hayPiezas = componentes && Object.values(componentes).some(Boolean);

  const guardar = async () => {
    setMensaje(null);
    setGuardando(true);
    try {
      await api.post('/builds/guardar', { nombre, uso, presupuesto, modo, componentes });
      setMensaje({ tipo: 'success', texto: '¡Configuración guardada!' });
      setTimeout(() => setAbierto(false), 1000);
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.response?.data?.error || 'Error al guardar' });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <>
      <Button variant="contained" color="secondary" disabled={!hayPiezas} onClick={() => setAbierto(true)}>
        Guardar presupuesto
      </Button>

      <Dialog open={abierto} onClose={() => setAbierto(false)} fullWidth maxWidth="xs">
        <DialogTitle>Guardar configuración</DialogTitle>
        <DialogContent>
          {mensaje && <Alert severity={mensaje.tipo} sx={{ mb: 2 }}>{mensaje.texto}</Alert>}
          <TextField
            autoFocus label="Nombre (opcional)" fullWidth sx={{ mt: 1 }}
            value={nombre} onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Mi PC gaming"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAbierto(false)}>Cancelar</Button>
          <Button variant="contained" onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default GuardarBuild;