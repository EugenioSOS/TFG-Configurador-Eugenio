
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/builds.controller');

router.post('/builds/validar', ctrl.validarBuild);
router.post('/builds/generar', ctrl.generarBuild);

module.exports = router;