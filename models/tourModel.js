const mongoose = require('mongoose');
const slugify = require('slugify');
// const validator = require('validator');
// const User = require('./userModel');

const tourSchema = new mongoose.Schema(
  {
    name: {
      // schema type options
      type: String,
      required: [true, 'A tour must have a name!'], // validator
      unique: true,
      trim: true,
      maxlength: [40, 'A tour name cannot have more than 40 characters'],
      minlength: [10, 'A tour name cannot have less than 10 characters'],
      // validate: [
      //   validator.isAlpha,
      //   'Tour name must only contain alphabetical characters',
      // ],
    },
    slug: String,
    duration: {
      type: Number,
      required: [true, 'A tour must have a duration!'],
    },
    difficulty: {
      type: String,
      required: [true, 'A tour must have a difficulty'], // this is just a shorthand for the complete object
      enum: {
        values: ['easy', 'medium', 'difficult'],
        message: 'Difficulty must be either: easy, medium or difficult',
      },
    },
    maxGroupSize: {
      type: Number,
      required: [true, 'A tour must have a group size'],
    },
    ratingsAverage: {
      type: Number,
      default: 4.5,
      min: [1, 'Ratings must be above 1.0'],
      max: [5, 'Ratings must be below 5.0'],
      set: (val) => Math.round(val * 10) / 10,
    },
    ratingsQuantity: {
      type: Number,
      default: 0,
    },
    price: {
      type: Number,
      required: [true, 'A tour must have a price!'],
    },
    priceDiscount: {
      type: Number,
      validate: {
        validator: function (val) {
          return val < this.price;
        },
        message: 'Discount price ({VALUE}) must be below the regular price!',
      },
    },
    summary: {
      type: String,
      trim: true, // tets rid of whitespace btn content
    },
    description: {
      type: String,
      trim: true,
    },
    imageCover: {
      type: String,
      required: [true, 'A tour must have a cover image'],
    },
    images: [String],
    createdAt: {
      type: Date,
      default: Date.now(),
      select: false,
    },
    startDates: [Date],
    // this is the most basic way of describing our data; name,price, rating and the data types that we expect for each field
    // we can take it a step further by defining SCHEMA TYPE OPTIONS for each field or only for a specific field
    secretTours: {
      type: Boolean,
      default: false,
    },
    startLocation: {
      // GeoJSON
      type: {
        type: String,
        default: 'Point',
        enum: ['Point'],
      },
      coordinates: [Number],
      address: String,
      description: String,
    },
    locations: [
      {
        type: {
          type: String,
          default: 'Point',
          enum: ['Point'],
        },
        coordinates: [Number],
        address: String,
        description: String,
        day: Number,
      },
    ],
    guides: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    toJSON: { virtuals: true }, // we want the virtuals to be part of the output
    toObject: { virtuals: true },
  }
);

tourSchema.index({ price: 1, ratingsAverage: -1 });
tourSchema.index({ slug: 1 });
tourSchema.index({ startLocation: '2dsphere'})

tourSchema.virtual('durationWeeks').get(function () {
  return this.duration / 7; // to get duration in weeks
  // in this case, the this keyword will be pointing to the current document
});

// Virtual populate
tourSchema.virtual('reviews', {
  ref: 'Review',
  foreignField: 'tour',
  localField: '_id',
});
// Document Middleware
// runs before .save() and .create()
// .insertMany() will NOT trigger the save command
tourSchema.pre('save', function (next) {
  // console.log(this);
  this.slug = slugify(this.name, { lower: true });
  next();
  // this function will be called right before the actual data is saved to the database
  // the this keyword in this function will point to the currently processed document
});

// tourSchema.pre('save', async function (next) {
//   const guidesPromises = this.guides.map(async (id) => await User.findById(id));
//   this.guides = await Promise.all(guidesPromises);
//   next();
// });

// tourSchema.post('save', function (doc, next) {
//   console.log(doc);
//   next();
//   // in this case, we only have 1 post middleware so we wouldn't need next(), but it's the best practice to always include it
//   // the middleware in this case is a pre-save hook
// });

// tourSchema.pre('save', function (next) {
//   console.log('Will save document...');
//   next();
// });

// QUERY MIDDLEWARE
// tourSchema.pre('find', function (next) {
// /^find/: all the strings that start with find
tourSchema.pre(/^find/, function (next) {
  this.find({ secretTours: { $ne: true } });

  this.start = Date.now();
  next();
});

tourSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'guides',
    select: '-__v -passwordChangedAt',
  });

  next();
});

// tourSchema.post(/^find/, function (docs, next) {
//   console.log(`The Query took ${Date.now() - this.start} milliseconds!`);
//   next();
// });

// AGGREGATION MIDDLEWARE
// tourSchema.pre('aggregate', function (next) {
//   // console.log(this);
//   this.pipeline().unshift({ $match: { secretTours: { $ne: true } } });
//   console.log('PIPELINE', this.pipeline()); // the array that we passed into the aggregate function before
//   next();
// });

const Tour = mongoose.model('Tour', tourSchema); //convention to always use uppercase on model names and variables; takes in name of model and schema

module.exports = Tour;
