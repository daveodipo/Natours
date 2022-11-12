const crypto = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const catchAsync = require('../utilities/catchAsync');
const AppError = require('../utilities/appError');
const Email = require('../utilities/email');

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);

  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
  };

  if (process.env.NODE_ENV === 'production') cookieOptions.secure = true;

  res.cookie('jwt', token);

  // Remove password from output
  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user,
    },
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  const newUser = await User.create({
    // with this, we allow only the data that we need to be put into the new user
    // even if a user tries to input a new role, we'll not store that into the new user
    name: req.body.name,
    email: req.body.email,
    role: req.body.role,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
    passwordChangedAt: req.body.passwordChangedAt,
  });
  const url = `${req.protocol}://${req.get('host')}/me`;
  // console.log(url);
  await new Email(newUser, url).sendWelcome();
  createSendToken(newUser, 201, res);
});

exports.login = catchAsync(async (req, res, next) => {
  // This is how the user will send in the login credentials for us to check
  const { email, password } = req.body;
  //   1) Check if email and passwords actually exist
  if (!email || !password) {
    next(new AppError('Please provide an email and a password!', 400));
  }
  //   2) Check if user exists && if password is correct
  //   we do need the password to check if it's correct
  const user = await User.findOne({ email }).select('+password'); // the output of this will also not contain the password
  //   if 'user' does not exist, this next line cannot run
  //   We thus need to move code into the if block

  //   if there's no user or password is incorrect
  if (!user || !(await user.correctPassword(password, user.password))) {
    // if 'user' does not exist, it won't even run the code after '||'
    return next(new AppError('Incorrect email or password!', 401));
  }

  // 3) If everything is ok, send token to client
  createSendToken(user, 200, res);
});

exports.logout = (req, res) => {
  res.cookie('jwt', 'loggedout', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });
  res.status(200).json({ status: 'success' });
};

exports.protect = catchAsync(async (req, res, next) => {
  let token;
  // 1) Get token and check if it exists
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    next(
      new AppError('You are not logged in! Please log in to get access.', 401)
    );
  }
  //   2) Verify token - jwt verifies validity of signature
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  // promisify(jwt.verify) is a function which we need to call which will then return the promise
  // we call it with (token, process.env.JWT_SECRET) and it returns a promise which we need to await and store the result into a variable

  //   3) Check if user still exits
  const currentUser = await User.findById(decoded.id); // this is not a new user, it's just the user based on the decoded ID
  if (!currentUser) {
    return next(
      new AppError(
        'The user for whom this token was issued no longer exists.',
        401
      )
    );
  }
  //   4) Check if user changed passwords after token was issued
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError(
        'This user recently changed their password! Please log in again.',
        401
      )
    );
  }

  // GRANT ACCESS TO PROTECTED ROUTE
  req.user = currentUser; // we assign currentUser to req.user so that we can use it in the next middleware function
  res.locals.user = currentUser;
  // the req object travels from middleware to middleware
  next();
});

// Only for renderred pages; no errors!
exports.isLoggedIn = catchAsync(async (req, res, next) => {
  // 1) Get token and check if it exists
  if (req.cookies.jwt) {
    try {
      //   2) Verify token - jwt verifies validity of signature
      const decoded = await promisify(jwt.verify)(
        req.cookies.jwt,
        process.env.JWT_SECRET
      );
      // promisify(jwt.verify) is a function which we need to call which will then return the promise
      // we call it with (token, process.env.JWT_SECRET) and it returns a promise which we need to await and store the result into a variable

      //   3) Check if user still exits
      const currentUser = await User.findById(decoded.id); // this is not a new user, it's just the user based on the decoded ID
      if (!currentUser) {
        return next();
      }
      //   4) Check if user changed passwords after token was issued
      if (currentUser.changedPasswordAfter(decoded.iat)) {
        return next();
      }

      // THERE IS A LOGGED IN USER
      res.locals.user = currentUser;
      return next();
    } catch (err) {
      return next();
    }
  }
  next();
});

exports.restrictTo =
  (...roles) =>
  (req, res, next) => {
    // roles  ['admin', 'lead-guide']
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 403)
      );
    }

    next();
  };

exports.forgotPassword = catchAsync(async (req, res, next) => {
  // 1. Get user based on posted email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError('There is no user with that email address.', 404));
  }
  // 2. Generate reset token
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  // 3. Send it back as an email
  try {
    const resetURL = `${req.protocol}://${req.get(
      'host'
    )}/api/v1/users/resetPassword/${resetToken}`;
    await new Email(user, resetURL).sendPasswordReset();

    res.status(200).json({
      status: 'success',
      message: 'Token sent to email!',
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(
      new AppError('There was an error sending the email. Try again later!'),
      500
    );
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  // 1. Get user based on token
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  // 2. If the token has not expired, and there is a user, set the new password
  if (!user) {
    return next(new AppError('Token is invalid or has expired.', 400));
  }
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();
  // 3. Update changedPasswordAt property for the user

  // 4. Log user in
  createSendToken(user, 200, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  // 1. Get user from collection
  const user = await User.findById(req.user.id).select('+password');

  // 2. Check if currently POSTed password is correct
  if (
    !user ||
    !(await user.correctPassword(req.body.passwordCurrent, user.password))
  ) {
    return next(new AppError('Your current password is wrong.', 401));
  }

  // 3. If so,update password
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();
  // User.findByIdAndUpdate() will NOT work as intended!

  // 4. Log user in, send jwt
  createSendToken(user, 200, res);
});
