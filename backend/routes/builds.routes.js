
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/builds.controller');
const guardadas = require('../controllers/builds-guardadas.controller');
const { verificarToken } = require('../middleware/auth');


router.post('/builds/validar', ctrl.validarBuild);
router.post('/builds/generar', ctrl.generarBuild);

router.post('/builds/guardar', verificarToken, guardadas.guardarBuild);
router.get('/builds/mis-builds', verificarToken, guardadas.misBuild);
router.put('/builds/:id', verificarToken, guardadas.actualizarBuild);
router.delete('/builds/:id', verificarToken, guardadas.borrarBuild);

module.exports = router;