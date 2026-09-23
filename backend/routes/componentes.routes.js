
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/componentes.controller');

router.get('/tipos', ctrl.listarTipos);
router.get('/componentes', ctrl.listarComponentes);
router.get('/componentes/:id', ctrl.obtenerComponente);

module.exports = router;