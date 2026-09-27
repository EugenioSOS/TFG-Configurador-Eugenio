const express = require('express');
const cors = require('cors');
require('dotenv').config();

BigInt.prototype.toJSON = function () {
  return Number(this);
};

const authRoutes = require('./routes/auth.routes');
const buildsRoutes = require('./routes/builds.routes');


const componentesRoutes = require('./routes/componentes.routes');
const app = express();
app.use(cors());
app.use(express.json());

app.use('/api', componentesRoutes);
app.use('/api', buildsRoutes);
app.use('/api', authRoutes);

app.get('/', (req, res) => res.send('API Configurador de PC - Coolmod Scraper'));
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Servidor escuchando en localhost: ${PORT}`));