import React, { useState } from 'react';
import {
  Box, Typography, ToggleButton, ToggleButtonGroup, TextField,
  Button, Stepper, Step, StepLabel, Alert,
} from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import BarraSuperior from './barrasuperior';

const PASOS = ['Uso del PC', 'Presupuesto', 'Nivel'];

const QuestionForm = () => {
  const location = useLocation();
  const [paso, setPaso] = useState(location.state?.paso || 0);
  const [uso, setUso] = useState(localStorage.getItem('uso') || '');
  const [presupuesto, setPresupuesto] = useState(localStorage.getItem('presupuesto') || '');
  const [preferencias, setPreferencias] = useState(localStorage.getItem('preferencias') || '');
  const [nivel, setNivel] = useState('');   // 'auto' (simple) | 'manual' (avanzado)
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const siguiente = () => {
    setError('');
    if (paso === 0 && !uso) return setError('Elige para qué usarás el PC.');
    if (paso === 1) {
      const p = Number(presupuesto);
      const minimo = uso === 'ofimatica' ? 500 : 800;
      if (!p) return setError('Introduce un presupuesto válido.');
      if (p < minimo) return setError(`Para ${uso === 'ofimatica' ? 'ofimática' : 'este uso'} el presupuesto mínimo es ${minimo} €.`);
    }
    if (paso === 2 && !nivel) return setError('Indica si quieres elegir tú los componentes.');
    if (paso < 2) { setPaso(paso + 1); return; }
    finalizar();
  };

  const atras = () => { setError(''); setPaso(Math.max(0, paso - 1)); };

  const finalizar = () => {
    // Guardamos uso y presupuesto para las siguientes pantallas.
    localStorage.setItem('uso', uso);
    localStorage.setItem('presupuesto', presupuesto);
    localStorage.setItem('preferencias', preferencias);
    // Bifurcacion: manual -> configurador avanzado ; auto -> configurador simple
    if (nivel === 'manual') navigate('/configurador-avanzado', { state: { uso, presupuesto } });
    else navigate('/configurador-simple', { state: { uso, presupuesto } });
  };

  return (
    <>
    <BarraSuperior />
    <Box sx={{ maxWidth: 520, mx: 'auto', mt: 5, p: 3 }}>
      <Stepper activeStep={paso} sx={{ mb: 4 }}>
        {PASOS.map((p) => (<Step key={p}><StepLabel>{p}</StepLabel></Step>))}
      </Stepper>

      {error && <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>}

      {paso === 0 && (
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h6" sx={{ mb: 2 }}>¿Para qué vas a usar el PC?</Typography>
          <ToggleButtonGroup exclusive value={uso} onChange={(e, v) => v && setUso(v)} orientation="vertical" sx={{ width: '100%' }}>
            <ToggleButton value="juegos">Juegos</ToggleButton>
            <ToggleButton value="diseno">Diseño / Render</ToggleButton>
            <ToggleButton value="ofimatica">Ofimática</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      )}

      {paso === 1 && (
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h6" sx={{ mb: 2 }}>¿Cuál es tu presupuesto?</Typography>
          <TextField
            type="number" label="Presupuesto (€)" value={presupuesto}
            onChange={(e) => setPresupuesto(e.target.value)} fullWidth
            InputProps={{ inputProps: { min: 200, step: 50 } }}
          />
          <TextField
            label="Preferencias (opcional)"
            placeholder="Ej: quiero Intel y 32GB de RAM, sin RGB"
            value={preferencias}
            onChange={(e) => setPreferencias(e.target.value)}
            fullWidth multiline minRows={2} sx={{ mt: 2 }}
            helperText="Puedes pedir marca de CPU/GPU, RAM mínima, formato compacto, etc."
          />
        </Box>
      )}

      {paso === 2 && (
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h6" sx={{ mb: 2 }}>¿Cómo prefieres montarlo?</Typography>
          <ToggleButtonGroup exclusive value={nivel} onChange={(e, v) => v && setNivel(v)} orientation="vertical" sx={{ width: '100%' }}>
            <ToggleButton value="auto">✨ Que me recomienden una configuración</ToggleButton>
            <ToggleButton value="manual">🔧 Elegir yo cada componente</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
        <Button onClick={atras} disabled={paso === 0}>Atrás</Button>
        <Button variant="contained" onClick={siguiente}>
          {paso < 2 ? 'Siguiente' : 'Ver configuración'}
        </Button>
      </Box>
    </Box>
    </>
  );
};

export default QuestionForm;