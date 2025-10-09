const { body } = require('express-validator');

const validateDriverCreation = [
  body('email')
    .isEmail()
    .withMessage('يجب أن يكون بريدًا إلكترونيًا صحيحًا')
    .normalizeEmail(),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('كلمة المرور يجب أن تكون على الأقل 6 أحرف'),
  
  body('name')
    .notEmpty()
    .withMessage('الاسم مطلوب')
    .isLength({ min: 2 })
    .withMessage('الاسم يجب أن يكون على الأقل حرفين'),
  
  body('phone')
    .notEmpty()
    .withMessage('رقم الهاتف مطلوب')
    .isMobilePhone()
    .withMessage('رقم الهاتف غير صحيح'),
  
  body('license')
    .notEmpty()
    .withMessage('رقم الرخصة مطلوب'),
  
  body('vehicle')
    .notEmpty()
    .withMessage('نوع المركبة مطلوب')
];

module.exports = { validateDriverCreation };