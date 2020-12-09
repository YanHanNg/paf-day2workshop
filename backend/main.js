const express = require('express');
const mysql = require('mysql2/promise');
const secureEnv = require('secure-env');

global.env = secureEnv({secret: 'isasecret'});

//Declare a instance of express
const app = express();

//Define PORT
const PORT = global.env.APP_PORT || 3000;

// Create the Database Connection Pool
const pool = mysql.createPool({
    host: global.env.MYSQL_SERVER || 'localhost',
    port: parseInt(global.env.MYSQL_SVR_PORT) || 3306,
    database: global.env.MYSQL_SCHEMA,
    user: global.env.MYSQL_USERNAME,
    password: global.env.MYSQL_PASSWORD,
    connectionLimit: parseInt(global.env.MYSQL_CONN_LIMIT) || 4,
    timezone: process.env.DB_TIMEZONE || '+08:00'
})

//Make a Closure, Take in SQLStatement and ConnPool
const makeQuery = (sql, pool) => {
    return (async (args) => {
        const conn = await pool.getConnection();
        try {
            let results = await conn.query(sql, args || []);
            //Only need first array as it contains the query results.
            //index 0 => data, index 1 => metadata
            return results[0];
        }
        catch(err) {
            console.error('Error Occurred during Query', err);
        }
        finally{
            conn.release();
        }
    })
}

const SQL_GETTOTALBYORDERID = "SELECT * from totalorderdetail where id = ?";

const getTotalByOrderId = makeQuery(SQL_GETTOTALBYORDERID, pool);

app.get('/order/total', (req, res) => {
    console.info(req);

    res.redirect(`/order/total/${req.query.orderId}`);
})

//Resources
//GET /order/total/<order_id>
app.get('/order/total/:order_id', (req, res) => {
    getTotalByOrderId([req.params['order_id']])
        .then(data => {
            console.info(data);

            if(data.length === 0)
                throw new Error('no corresponding data found');

            //Use res.format to return in different type
            res.format({
                'text/html': ()=> {
                    res.send(data);
                },
                'application/json': () => {
                    if(data.length > 0)
                    res.status(200).json(data);
                        else
                    res.status(404).json({message: 'no corresponding data found'});
                }
            })
        })
        .catch(err => {
            console.error('Error occurred', err);
            console.info(err);
            res.status(500).json(err.message);
        });
})

app.use(express.static(__dirname + '/public'))

//Start Express
pool.getConnection()
    .then(conn => {
        const param1 = Promise.resolve(conn);
        const param2 = conn.ping();
        return Promise.all( [ param1, param2 ] );
    })
    .then(results => {
        const conn = results[0];
        app.listen(PORT, () => {
            console.info(`Server Started on PORT ${PORT} at ${new Date()}`);
        })
        conn.release();
    })
    .catch(err => {
        console.error('Error in connection to mysql', err);
    })