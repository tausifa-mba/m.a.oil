class BaseRepository {
  constructor(model) {
    this.model = model;
  }

  async create(data, session = null) {
    if (session) {
      const [doc] = await this.model.create([data], { session });
      return doc;
    }
    return await this.model.create(data);
  }

  async findById(id, populate = '', session = null) {
    let query = this.model.findById(id);
    if (populate) query = query.populate(populate);
    if (session) query = query.session(session);
    return await query.exec();
  }

  async findOne(filter, populate = '', session = null) {
    let query = this.model.findOne(filter);
    if (populate) query = query.populate(populate);
    if (session) query = query.session(session);
    return await query.exec();
  }

  async update(id, data, session = null) {
    let query = this.model.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (session) query = query.session(session);
    return await query.exec();
  }

  async delete(id, session = null) {
    let query = this.model.findByIdAndDelete(id);
    if (session) query = query.session(session);
    return await query.exec();
  }

  async findAll({ filter = {}, search = '', searchFields = [], page = 1, limit = 10, sortBy = 'createdAt:desc', populate = '' }) {
    let finalFilter = { ...filter };

    if (search && searchFields.length > 0) {
      const searchConditions = searchFields.map(field => ({
        [field]: { $regex: search, $options: 'i' }
      }));
      
      // If finalFilter already has an $or, combine them or wrap them
      if (finalFilter.$and) {
        finalFilter.$and.push({ $or: searchConditions });
      } else if (finalFilter.$or) {
        finalFilter.$and = [{ $or: finalFilter.$or }, { $or: searchConditions }];
        delete finalFilter.$or;
      } else {
        finalFilter.$or = searchConditions;
      }
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    let sort = {};
    if (sortBy) {
      const parts = sortBy.split(':');
      sort[parts[0]] = parts[1] === 'desc' ? -1 : 1;
    } else {
      sort = { createdAt: -1 };
    }

    let query = this.model.find(finalFilter).sort(sort).skip(skip).limit(limitNum);
    if (populate) {
      query = query.populate(populate);
    }

    const data = await query.exec();
    const total = await this.model.countDocuments(finalFilter);

    return {
      data,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
    };
  }
}

module.exports = BaseRepository;
