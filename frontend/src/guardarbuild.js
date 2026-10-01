import React, { useState } from 'react';
import {
  Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Alert,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import api from './api';

// Props:
//   componentes: { cpu: id, placa: id, ... }
//   uso, presupuesto, modo
//   buildId (opcional): si viene, es una build existente -> permite ACTUALIZAR o guardar como NUEVA
const GuardarBuild = ({ componentes, uso, presupuesto, modo, buildId }) => {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState('');
  const [mensaje, setMensaje] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const navigate = useNavigate();

  const hayPiezas = componentes && Object.values(componentes).some(Boolean);
  const body = () => ({ nombre, uso, presupuesto, modo, componentes });

  const guardarNueva = async () => {
    setMensaje(null); setGuardando(true);
    try {
      await api.post('/builds/guardar', body());
      setMensaje({ tipo: 'success', texto: '¡Guardada como nueva configuración!' });
      setTimeout(() => setAbierto(false), 1000);
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.response?.data?.error || 'Error al guardar' });
    } finally { setGuardando(false); }
  };

  const actualizar = async () => {
    setMensaje(null); setGuardando(true);
    try {
      await api.put(`/builds/${buildId}`, body());
      setMensaje({ tipo: 'success', texto: '¡Configuración actualizada!' });
      setTimeout(() => { setAbierto(false); navigate('/mis-presupuestos'); }, 1000);
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.response?.data?.error || 'Error al actualizar' });
    } finally { setGuardando(false); }
  };

  return (
    <>
      <Button variant="contained" color="secondary" disabled={!hayPiezas} onClick={() => setAbierto(true)}>
        {buildId ? 'Guardar cambios' : 'Guardar presupuesto'}
      </Button>

      <Dialog open={abierto} onClose={() => setAbierto(false)} fullWidth maxWidth="xs">
        <DialogTitle>{buildId ? 'Guardar cambios' : 'Guardar configuración'}</DialogTitle>
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
          {buildId && (
            <Button onClick={actualizar} disabled={guardando}>Actualizar esta</Button>
          )}
          <Button variant="contained" onClick={guardarNueva} disabled={guardando}>
            {buildId ? 'Guardar como nueva' : (guardando ? 'Guardando…' : 'Guardar')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default GuardarBuild;