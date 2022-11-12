const mongoose = require('mongoose');
const dotenv = require('dotenv');

process.on('uncaughtException', (err) => {
  console.log('UNCAUGHT EXCEPTION💥 Shutting down...');
  console.log(err.name, err.message);
  process.exit(1);
});

dotenv.config({ path: './config.env' }); //pass  path to specify where our config file is located
// the command in the above line will read our variables from the file and save them into Node.js environmental variables
const app = require('./App');

const DB = process.env.DATABASE.replace(
  '<PASSWORD>',
  process.env.DATABASE_PASSWORD
);

mongoose
  .connect(DB, {
    // specifications to deal with deprecation warnings
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false,
    useUnifiedTopology: true 
    // the connect method returns a promise which we need to handle by using 'then'
    // the promise gets access to a connection object
  })
  .then(() => console.log('DB connections successful!'));

// 4. START SERVER
// To start up a server:
console.log(process.env.PORT);
const port = process.env.PORT || 8000;
const server = app.listen(port, () => {
  console.log(`App running on port ${port}...`);
});

console.log(app.get('env')); //set by Express
// console.log(process.env)//set by Node: come from the process core module

process.on('unhandledRejection', (err) => {
  console.log('UNHANDLED REJECTION💥 Shutting down...');
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});
