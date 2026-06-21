const mongoose = require('mongoose');

const uri = 'mongodb+srv://tausifahmadjsr91_db_user:qlCyC4j3SGYlDRTj@maoil.tmngahv.mongodb.net/container_erp?retryWrites=true&w=majority';

console.log('Attempting Mongoose connection to Atlas...');
console.log(`URI: mongodb+srv://tausifahmadjsr91_db_user:*****@maoil.tmngahv.mongodb.net/container_erp`);

mongoose.connect(uri)
  .then(() => {
    console.log('SUCCESS: Mongoose connected to MongoDB Atlas successfully!');
    process.exit(0);
  })
  .catch(err => {
    console.error('FAILURE: Mongoose connection failed.');
    console.error('Error Name:', err.name);
    console.error('Error Message:', err.message);
    console.error('Full Error Stack:', err.stack);
    process.exit(1);
  });
