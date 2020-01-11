import Axios from 'axios'

const Type = {
  collection: {apiPath: '/collections', key: 'collections'},
  environment: {apiPath: '/environments', key: 'environments'}
}

export class PostmanApi {

  constructor(apiKey) {
    this.axios = Axios.create({
      baseURL: 'https://api.getpostman.com',
      headers: {
        "X-Api-Key": apiKey
      }
    })
  }

  type(type) {
    if (type === 'collection') {
      return Type.collection
    } else if (type === 'environment') {
      return Type.environment
    }
  }

  async list(type) {
    const res = await this.axios.get(type.apiPath)
    if (res.data) {
      return res.data[type.key]
    } else {
      console.error(res)
      console.error(res.data.error)
      throw new Error("Postman Api Error")
    }
  }

  async get(type, uid) {
    const res = await this.axios.get(`${type.apiPath}/${uid}`)
    if (res.data) {
      return res.data
    } else {
      console.error(res)
      console.error(res.data.error)
      throw new Error("Postman Api Error")
    }
  }

  async create(type, obj) {
    const res = await this.axios.post(`${type.apiPath}`, obj)
    if (res.data) {
      return res.data
    } else {
      console.error(res)
      console.error(res.data.error)
      throw new Error("Postman Api Error")
    }
  }

  async update(type, uid, obj) {
    const res = await this.axios.put(`${type.apiPath}/${uid}`, obj)
      .catch((e)=> {
        console.error(e.response.data)
      })
    if (res.data) {
      return res.data
    } else {
      console.error(res)
      console.error(res.data.error)
      throw new Error("Postman Api Error")
    }
  }

  async listCollections() {
    return this.list(Type.collection)
  }

  async listEnvironments() {
    return this.list(Type.environment)
  }

  async getCollection(uid) {
    return this.get(Type.collection, uid)
  }

  async getEnvironment(uid) {
    return this.get(Type.environment, uid)
  }

  async createCollection(collection) {
    return this.create(Type.collection, collection)
  }

  async updateCollection(uid, collection) {
    return this.update(Type.collection, uid, collection)
  }

  async createEnvironment(environment) {
    return this.create(Type.environment, environment)
  }

  async updateEnvironment(uid, environment) {
    return this.update(Type.environment, uid, environment)
  }
}