class APIFeatures {
  constructor(query, queryString) {
    // we have access to the Mongoose query and the query string coming from Express (route)
    // we pass in query because querying inside the class would bound the query to the class; we want re-usability
    this.query = query;
    this.queryString = queryString;
  }

  filter() {
    // eslint-disable-next-line node/no-unsupported-features/es-syntax
    const queryObj = { ...this.queryString };
    // array of all fields that we wish to exclude
    const excludedFields = ['page', 'sort', 'limit', 'fields'];
    // we loop over the query fields to remove the excluded fields from our query object
    excludedFields.forEach((el) => delete queryObj[el]);

    // 1B) Advanced Filtering
    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/\b(gt|gte|lt|lte)\b/g, (match) => `$${match}`);
    // we use \b\b to match the exact same words, without any other string around it
    // /g flag means it will happen multiple times; if we have 2 or more operators, it will replace all of them

    this.query = this.query.find(JSON.parse(queryStr));
    // we don't wanna query Tour directly
    // we want to add find() to the query that we already have
    // let query = Tour.find(JSON.parse(queryStr));

    return this;
    // we return this in order to return the entire object which then has access to the other methods
  }

  sort() {
    if (this.queryString.sort) {
      const sortBy = this.queryString.sort.split(',').join(' ');
      this.query = this.query.sort(sortBy);
      // sort('price', 'ratingsAverage')
    } else {
      this.query = this.query.sort('-createdAt');
    }
    return this;
  }

  limitFields() {
    if (this.queryString.fields) {
      const fields = this.queryString.fields.split(',').join(' ');
      this.query = this.query.select(fields);
    } else {
      this.query = this.query.select('-__v');
    }
    return this;
  }

  paginate() {
    const page = this.queryString.page * 1 || 1; // x1 to turn it into a number
    const limit = this.queryString.limit * 1 || 100;
    const skip = (page - 1) * limit;
    // page=2&limit=10 we want to skip 10 results before we start querying
    // 1-10:page 1, 11-20:page 2
    this.query = this.query.skip(skip).limit(limit);

    return this;
  }
}

module.exports = APIFeatures;
