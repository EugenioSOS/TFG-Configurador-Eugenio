const { ApifyClient } = require('apify-client');
const { Pool } = require('pg');
require('dotenv').config();

// Configuración de Apify
const client = new ApifyClient({
  token: process.env.APIFY_TOKEN, // Asegúrate de tener el token de Apify en tu archivo .env
});

// Configuración de la conexión a PostgreSQL
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

// Función para ejecutar el scraper y llenar la base de datos
async function runScraperAndInsert(category = 'all', search = '', limit = 20) {
  try {
    // Ejecutar el scraper de PCPartPicker
    const run = await client.actor('matyascimbulka/pcpartpicker-scraper').call({
      searchPhrases: [search],
      category,
      maxProducts: limit,
      maxReviews: 0, // No necesitamos los reviews en este caso
    });

    // Obtener los datos del dataset de forma sincrónica usando listItems()
    const dataset = await client.dataset(run.defaultDatasetId).listItems({
      limit: 1000, // Número de items que deseas obtener. Ajusta según lo necesario.
    });

    // Verificar si dataset.items está disponible
    if (dataset && dataset.length > 0) {
      // Iterar sobre los items en el dataset y guardarlos en la base de datos
      for (const item of dataset) {
        const { name, price, brand, category, rating, reviews, url } = item;

        // Especificaciones como un objeto JSON
        const specs = {
          rating,
          reviews,
          url,
        };

        // Insertar los datos en la tabla 'components'
        await pool.query(
          `INSERT INTO components (name, price, brand, category, specs, url)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (name, category) DO NOTHING`,  // Evitar duplicados si ya existe el mismo componente
          [name, price, brand, category || 'unknown', specs, url]
        );
      }

      console.log('Datos insertados correctamente');
    } else {
      console.error('No se encontraron items en el dataset');
    }
  } catch (err) {
    console.error('Error al ejecutar el scraper e insertar los datos:', err);
  }
}

// Llamar a la función con parámetros de ejemplo (por ejemplo, categoría "all" y "GPU")
runScraperAndInsert('all', '', 20); 