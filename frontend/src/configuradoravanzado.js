import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, FormControl, InputLabel, Select, MenuItem, Grid,
  Button, Alert, Divider, CircularProgress, Chip,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import api from './api';
import GuardarBuild from './guardarbuild';
import BarraSuperior from './barrasuperior';

// tipo interno -> etiqueta visible
const TIPOS = [
  ['cpu', 'Procesador'], ['placa', 'Placa base'], ['ram', 'Memoria RAM'],
  ['gpu', 'Tarjeta gráfica'], ['almacenamiento', 'Almacenamiento'],
  ['fuente', 'Fuente'], ['refrigeracion', 'Refrigeración'], ['caja', 'Caja'],
];

const ConfiguradorAvanzado = () => {
  const [opciones, setOpciones] = useState({});      // { cpu: [...], gpu: [...] }
  const [seleccion, setSeleccion] = useState({});    // { cpu: id, gpu: id }
  const [resultado, setResultado] = useState(null);  // respuesta de /validar
  const [cargando, setCargando] = useState(true);
  const navigate = useNavigate();

  const uso = localStorage.getItem('uso') || null;
  const presupuesto = localStorage.getItem('presupuesto') || null;

  // Cargar las opciones de cada tipo (para llenar los desplegables).
  useEffect(() => {
    (async () => {
      try {
        const res = {};
        for (const [tipo] of TIPOS) {
          const r = await api.get(`/componentes`, { params: { tipo, porPagina: 100 } });
          res[tipo] = r.data.datos || [];
        }
        setOpciones(res);
      } catch (e) {
        console.error(e);
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  // Valida en el backend cada vez que cambia la seleccion.
  const validar = useCallback(async (sel) => {
    const body = { ...sel, uso, presupuesto: presupuesto ? Number(presupuesto) : null };
    try {
      const res = await api.post('/builds/validar', body);
      setResultado(res.data);
    } catch (e) {
      console.error(e);
    }
  }, [uso, presupuesto]);

  const cambiar = (tipo, id) => {
    const sel = { ...seleccion, [tipo]: id || undefined };
    if (!id) delete sel[tipo];
    setSeleccion(sel);
    validar(sel);
  };

  // precio de una oferta (la mas barata)
  const precioDe = (comp) => (comp.ofertas && comp.ofertas[0] ? comp.ofertas[0].precio : null);

  if (cargando) return (
    <Box sx={{ textAlign: 'center', mt: 8 }}>
      <CircularProgress /><Typography sx={{ mt: 2 }}>Cargando componentes…</Typography>
    </Box>
  );

  return (
    <>
    <BarraSuperior />
    <Box sx={{ maxWidth: 900, mx: 'auto', mt: 4, p: 2 }}>
      <Typography variant="h4" gutterBottom>Configurador avanzado</Typography>
      {uso && <Typography color="text.secondary">Uso: {uso} · Presupuesto: {presupuesto} €</Typography>}

      <Grid container spacing={2} sx={{ mt: 1 }}>
        {TIPOS.map(([tipo, etiqueta]) => (
          <Grid item xs={12} sm={6} key={tipo}>
            <FormControl fullWidth>
              <InputLabel>{etiqueta}</InputLabel>
              <Select
                label={etiqueta}
                value={seleccion[tipo] || ''}
                onChange={(e) => cambiar(tipo, e.target.value)}
              >
                <MenuItem value=""><em>— sin elegir —</em></MenuItem>
                {(opciones[tipo] || []).map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.nombre} {precioDe(c) != null ? `— ${precioDe(c)} €` : ''}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        ))}
      </Grid>

      <Divider sx={{ my: 3 }} />

      {/* Resultado de la validacion en vivo */}
      {resultado && (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Chip
              label={resultado.compatible ? 'Compatible ✓' : 'Incompatible ✗'}
              color={resultado.compatible ? 'success' : 'error'}
            />
            <Typography variant="h6">Total: {resultado.total} €</Typography>
          </Box>

          {resultado.errores.length > 0 && (
            <Alert severity="error" sx={{ mb: 1 }}>
              {resultado.errores.map((e, i) => <div key={i}>{e}</div>)}
            </Alert>
          )}
          {resultado.avisos.length > 0 && (
            <Alert severity="warning" sx={{ mb: 1 }}>
              {resultado.avisos.map((a, i) => <div key={i}>{a}</div>)}
            </Alert>
          )}
          {resultado.ok.length > 0 && (
            <Alert severity="success" sx={{ mb: 1 }}>
              {resultado.ok.map((o, i) => <div key={i}>{o}</div>)}
            </Alert>
          )}
        </Box>
      )}

      <Box sx={{ mt: 3, display: 'flex', gap: 1 }}>
        <Button onClick={() => navigate('/questions')}>Volver</Button>
        <GuardarBuild
          componentes={seleccion}
          uso={uso}
          presupuesto={presupuesto}
          modo="avanzado"
        />
      </Box>
    </Box>
    </>
  );
};

export default ConfiguradorAvanzado;