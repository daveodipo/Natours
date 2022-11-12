const catchAsync = require('../utilities/catchAsync');
const AppError = require('../utilities/appError');
const APIFeatures = require('../utilities/api-features');

exports.deleteOne = (Model) =>
  catchAsync(async (req, res, next) => {
    const doc = await Model.findByIdAndDelete(req.params.id);

    if (!doc) {
      return next(new AppError('No document found with that ID', 404));
    }

    res.status(204).json({
      status: 'success',
      data: null, // this shows that the response that we deleted no longer exists
    });
  });

exports.updateOne = (Model) =>
  catchAsync(async (req, res, next) => {
    // we need to querry for the document that we wish to update then update it (based on ID)
    const doc = await Model.findByIdAndUpdate(req.params.id, req.body, {
      new: true, // the new updated document is returned
      runValidators: true,
    });

    if (!doc) {
      return next(new AppError('No document found with that ID', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        data: doc,
      },
    });
  });

exports.createOne = (Model) =>
  catchAsync(async (req, res, next) => {
    const doc = await Model.create(req.body);

    res.status(201).json({
      status: 'success',
      data: {
        data: doc,
      },
    });
  });

exports.getOne = (Model, popOptions) =>
  catchAsync(async (req, res, next) => {
    let query = Model.findById(req.params.id);
    if (popOptions) query = query.populate(popOptions);
    const doc = await query;

    if (!doc) {
      return next(new AppError('No document found with that ID', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        data: doc,
      },
    });
  });

exports.getAll = (Model) =>
  catchAsync(async (req, res, next) => {
    // To allow for nested GET reviews on Tour (hack)
    let filter = {};
    if (req.params.tourId) filter = { tour: req.params.tourId };

    const features = new APIFeatures(Model.find(filter), req.query)
      .filter()
      .sort()
      .limitFields()
      .paginate();
    // we're creating an instance of APIFeatures; features will have access to all the methods defined in APIFeatures
    // pass in the query object and query string
    // all of the chaining above only works because after chaining each of these methods, we always return this
    // const doc = await features.query.explain();
    const doc = await features.query;
    // our query currently looks something like this:
    // query.sort().select().skip().limit()
    // each of these methods will always return a query that we can chain on the subsequent methods until we finally await the query so that it can return our docs

    // SEND RESPONSE
    res.status(200).json({
      status: 'success',
      results: doc.length,
      data: doc,
    });
  });
