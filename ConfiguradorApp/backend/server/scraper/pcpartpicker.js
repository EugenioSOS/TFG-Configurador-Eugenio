 const {ApifyClient}= require('apify-client');
 const {Pool} = require('pg');
 require ('dotenv').config();

 const client= new ApifyClient({
     token: process.env.APIFY_TOKEN,});

 const pool= new Pool({
     user: process.env.PG_USER,
        host: process.env.PG_HOST,
        database: process.env.PG_DATABASE,
        password: process.env.PG_PASSWORD,
        port: process.env.PG_PORT,
 });

 async function runScraperAndInsert(category='all',search='',limit=20)
 {

    const run = await client.actor('matyascimbulka/pcpartpicker-scraper').call({
    searchPhrases: [search],
    category,
    maxProducts:limit,
    maxReviews:0,       
    });


    for await(const item of client.dataset(run.defaultDatasetId).iterateItems())
    {
        const {name,price,brand,category}=item;
        const specs={
            rating: item.rating,
            reviews: item.reviews,
            url: item.url,
        };
       
        await pool.query(
            `INSERT INTO components (name, price, brand, category, specs)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT  DO NOTHING`,
             [category || 'unknown', name, brand, price || 0, specs]
        );

     }

 }
 module.exports = { runScraperAndInsert };