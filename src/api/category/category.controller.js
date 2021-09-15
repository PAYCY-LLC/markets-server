const Category = require('../../db/models/Category')
const serializer = require('./category.serializer')

exports.index = async (req, res) => {
  const categories = await Category.findAll()
  res.status(200).json(serializer.serialize(categories))
}
