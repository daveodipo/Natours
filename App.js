const path = require('path');
const express = require('express');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');

// eslint-disable-next-line node/no-deprecated-api
const exp = require('constants');
const AppError = require('./utilities/appError');
const globalErrorHandler = require('./controllers/errorController');

const tourRouter = require('./routes/tourRoutes');
const userRouter = require('./routes/userRoutes');
const reviewRouter = require('./routes/reviewRoutes');
// const bookingRouter = require('./routes/bookingRoutes');
const viewRouter = require('./routes/viewRoutes');

const app = express(); //express is a function which upon calling will add a bunch of methods to the app variable

app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

// 1.GLOBAL MIDDLEWARES
// Serving static files
// app.use(express.static(`${__dirname}/public`));
app.use(express.static(path.join(__dirname, 'public')));

// Set Security HTTP headers
app.use(helmet());

// Development logging
console.log(process.env.NODE_ENV);
if (process.env.NODE_ENV === 'development') {
  // the readinng of the process only needs to happen once, and the process is the same no matter which file we're in
  app.use(morgan('dev'));
}

// Limit requests from same API
const limiter = rateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000,
  message: 'Too many requests from this IP, please try again in an hour',
});

app.use('/api', limiter);

// Body parser: reading data from body into req.body
app.use(express.json({ limit: '10kb' })); //'express.json' here is middleware
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// Data sanitization agains XSS
app.use(xss());

// Prevent parameter pollution
app.use(
  hpp({
    whitelist: [
      'duration',
      'ratingsAverage',
      'ratingsQuantity',
      'maxGroupSize',
      'difficulty',
      'price',
    ],
  })
);

// Test middleware
app.use((req, res, next) => {
  // we have access to the requestTime property; assuming we want to display the time of the request
  req.requestTime = new Date().toISOString();
  next();
  // console.log(req.cookies);
});

// 3. ROUTES: this is where we mount our routers

// these 3 routers are actually middlewares that we mount upon the paths
app.use('/', viewRouter); //mounted right on the root URL
app.use('/api/v1/tours', tourRouter); //we've created a sub-app with this
app.use('/api/v1/users', userRouter);
app.use('/api/v1/reviews', reviewRouter);
// app.use('/api/v1/bookings', bookingRouter);
// this router is essentially a sub-app for each resource
// the request goes into middleware and when it hits the above line of code, it will match the url, and thus the tourRouter middleware function will run

app.all('*', (req, res, next) => {
  next(new AppError(`Cant find ${req.originalUrl} on this server!`, 404));
});

app.use(globalErrorHandler);

module.exports = app;
