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
  const [buildId, setBuildId] = useState(null);      // si editamos una guardada
  const navigate = useNavigate();

  const uso = localStorage.getItem('uso') || null;
  const presupuesto = localStorage.getItem('presupuesto') || null;

  // Carga TODO en un solo efecto y en orden: lee la build a editar, carga las
  // opciones, trae las piezas elegidas que no esten entre las primeras 100, y fija
  // la seleccion. (Antes habia dos efectos y uno borraba 'editarBuild' antes de que
  // el otro lo usara, por eso se perdian componentes.)
  useEffect(() => {
    (async () => {
      try {
        // 1) leer la build a editar (si venimos de personalizar/editar)
        let comp = {};
        let bId = null;
        const raw = localStorage.getItem('editarBuild');
        if (raw) {
          try { const d = JSON.parse(raw); comp = d.componentes || {}; bId = d.buildId || null; } catch (e) {}
        }

        // 2) cargar opciones de cada tipo
        const res = {};
        for (const [tipo] of TIPOS) {
          const r = await api.get(`/componentes`, { params: { tipo, porPagina: 100 } });
          res[tipo] = r.data.datos || [];
        }

        // 3) garantizar que cada pieza elegida este en sus opciones
        for (const [tipo] of TIPOS) {
          const id = comp[tipo];
          if (id && !(res[tipo] || []).some((c) => Number(c.id) === Number(id))) {
            try {
              const det = await api.get(`/componentes/${id}`);
              if (det.data && det.data.id) res[tipo] = [det.data, ...(res[tipo] || [])];
            } catch (e) { /* si no se puede traer, se queda sin esa opcion */ }
          }
        }

        setOpciones(res);

        // 4) fijar la seleccion y validar de entrada
        if (Object.keys(comp).length > 0) {
          setSeleccion(comp);
          setBuildId(bId);
          setTimeout(() => validar(comp), 200);
        }

        // 5) consumir la build a editar (al final, cuando ya se ha usado)
        localStorage.removeItem('editarBuild');
      } catch (e) {
        console.error(e);
      } finally {
        setCargando(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Hay incompatibilidad REAL si existe algun error que NO sea por falta de piezas
  // imprescindibles (esos son normales mientras montas la build).
  const hayIncompatibilidad = !!(resultado && resultado.errores &&
    resultado.errores.some((e) => !/Falta un componente imprescindible|Falta la tarjeta grafica/i.test(e)));

  return (
    <>
    <BarraSuperior />
    <Box sx={{ maxWidth: 900, mx: 'auto', mt: 4, p: 2 }}>
      <Typography variant="h4" gutterBottom>Configurador avanzado</Typography>
      {uso && <Typography color="text.secondary">Uso: {uso} · Presupuesto: {presupuesto} €</Typography>}

      {hayIncompatibilidad && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Resuelve la incompatibilidad para poder seguir añadiendo componentes.
        </Alert>
      )}

      <Grid container spacing={2} sx={{ mt: 1 }}>
        {TIPOS.map(([tipo, etiqueta]) => {
          // Hay incompatibilidad si el ultimo analisis la marco.
          const hayConflicto = hayIncompatibilidad;
          const yaElegido = seleccion[tipo] != null && seleccion[tipo] !== '';
          // Con conflicto, se bloquean los desplegables de piezas AUN no elegidas
          // (los ya elegidos quedan activos para poder resolver el conflicto).
          const bloqueado = hayConflicto && !yaElegido;
          return (
          <Grid item xs={12} sm={6} key={tipo}>
            <FormControl fullWidth disabled={bloqueado}>
              <InputLabel>{etiqueta}</InputLabel>
              <Select
                label={etiqueta}
                value={seleccion[tipo] != null ? Number(seleccion[tipo]) : ''}
                onChange={(e) => cambiar(tipo, e.target.value)}
              >
                <MenuItem value=""><em>— sin elegir —</em></MenuItem>
                {(opciones[tipo] || []).map((c) => (
                  <MenuItem key={c.id} value={Number(c.id)}>
                    {c.nombre} {precioDe(c) != null ? `— ${precioDe(c)} €` : ''}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          );
        })}
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
        <Button onClick={() => navigate(-1)}>Volver</Button>
        <GuardarBuild
          componentes={seleccion}
          uso={uso}
          presupuesto={presupuesto}
          modo="avanzado"
          buildId={buildId}
        />
      </Box>
    </Box>
    </>
  );
};

export default ConfiguradorAvanzado;