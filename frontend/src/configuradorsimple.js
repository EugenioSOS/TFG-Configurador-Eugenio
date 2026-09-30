import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Card, CardContent, Chip, Divider, Button,
  CircularProgress, Alert, Grid, List, ListItem, ListItemText, Tabs, Tab,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import api from './api';
import GuardarBuild from './guardarbuild';
import BarraSuperior from './barrasuperior';

const NOMBRE_GAMA = { economica: 'Económica', equilibrada: 'Equilibrada', alta: 'Gama alta' };
const TIPOS = [
  ['cpu', 'Procesador'], ['placa', 'Placa base'], ['ram', 'Memoria RAM'],
  ['gpu', 'Tarjeta gráfica'], ['almacenamiento', 'Almacenamiento'],
  ['fuente', 'Fuente'], ['refrigeracion', 'Refrigeración'], ['caja', 'Caja'],
];

const ConfiguradorSimple = () => {
  const [builds, setBuilds] = useState(null);
  const [gama, setGama] = useState('equilibrada');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const uso = localStorage.getItem('uso');
  const presupuesto = localStorage.getItem('presupuesto');

  useEffect(() => {
    if (!uso || !presupuesto) { navigate('/questions'); return; }
    (async () => {
      try {
        const res = await api.post('/builds/generar', { uso, presupuesto: Number(presupuesto) });
        setBuilds(res.data.builds);
      } catch (err) {
        setError(err.response?.data?.error || 'Error al generar la configuración');
      } finally {
        setCargando(false);
      }
    })();
  }, [uso, presupuesto, navigate]);

  if (cargando) return (
    <Box sx={{ textAlign: 'center', mt: 8 }}>
      <CircularProgress /><Typography sx={{ mt: 2 }}>Generando tu configuración…</Typography>
    </Box>
  );
  if (error) return <Alert severity="error" sx={{ m: 4 }}>{error}</Alert>;
  if (!builds) return null;

  const build = builds[gama];
  const piezas = build.piezas;

  return (
    <>
    <BarraSuperior />
    <Box sx={{ maxWidth: 900, mx: 'auto', mt: 4, p: 2 }}>
      <Typography variant="h4" gutterBottom>Configuración recomendada</Typography>
      <Typography color="text.secondary" gutterBottom>
        Uso: {uso} · Presupuesto: {presupuesto} €
      </Typography>

      <Tabs value={gama} onChange={(e, v) => setGama(v)} sx={{ mb: 2 }}>
        {Object.keys(builds).map((g) => (
          <Tab key={g} value={g} label={`${NOMBRE_GAMA[g]} · ${builds[g].total} €`} />
        ))}
      </Tabs>

      {/* Avisos y estado de compatibilidad */}
      {build.errores.length > 0 && (
        <Alert severity="error" sx={{ mb: 1 }}>
          {build.errores.map((e, i) => <div key={i}>{e}</div>)}
        </Alert>
      )}
      {build.avisos.length > 0 && (
        <Alert severity="warning" sx={{ mb: 1 }}>
          {build.avisos.map((a, i) => <div key={i}>{a}</div>)}
        </Alert>
      )}
      {build.compatible && build.errores.length === 0 && (
        <Alert severity="success" sx={{ mb: 1 }}>Configuración compatible ✓</Alert>
      )}

      <Grid container spacing={2} sx={{ mt: 1 }}>
        {TIPOS.map(([clave, etiqueta]) => {
          const p = piezas[clave];
          return (
            <Grid item xs={12} sm={6} key={clave}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="overline" color="text.secondary">{etiqueta}</Typography>
                  {p ? (
                    <>
                      <Typography variant="body1">{p.nombre}</Typography>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                        <Chip label={`${p.precio} €`} color="primary" size="small" />
                        {p.url && <Button size="small" href={p.url} target="_blank">Ver en tienda</Button>}
                      </Box>
                    </>
                  ) : (
                    <Typography variant="body2" color="text.secondary">— (no incluido)</Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      <Divider sx={{ my: 3 }} />
      <Box sx={{ display: 'flex', justifyContºent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">Total: {build.total} €</Typography>
        <Box>
          <Button onClick={() => navigate('/questions')} sx={{ mr: 1 }}>Volver</Button>
          <Button variant="contained" onClick={() => navigate('/configurador-avanzado')}>
            Personalizar
          </Button>
          <GuardarBuild
  componentes={Object.fromEntries(
    Object.entries(build.piezas).filter(([k, v]) => v && v.id).map(([k, v]) => [k, v.id])
  )}
  uso={uso} presupuesto={presupuesto} modo="simple"
/>
        </Box>
      </Box>
    </Box>
    </>
  );
};

export default ConfiguradorSimple;