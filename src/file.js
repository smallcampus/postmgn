import fs from "fs-extra"
import fx from 'mkdir-recursive'

const Type = {
  collection: {},
  environment: {}
}

export class FileModule {

  constructor(collectionPath, environmentPath) {
    this.collectionPath = collectionPath
    this.environmentPath = environmentPath
  }

  type(type) {
    if (type === 'collection') {
      return Type.collection
    } else if (type === 'environment') {
      return Type.environment
    }
  }

  async getJsonFilenames(path) {
    let files = await fs.readdir(path)
    return files.filter(name => name.endsWith('.json'))
      .map(name => name.slice(0, name.length - 5))
  }

  async ensureDirectoryExist() {
    await this.mkdir(this.collectionPath)
    await this.mkdir(this.environmentPath)
  }

  async mkdir(path) {
    return new Promise((resolve) => {
      fx.mkdir(path, () => resolve())
    })
  }

  async writeCollection(name, collection) {
    return this.write(Type.collection, name, collection)
  }

  async writeEnvironment(name, environment) {
    return this.write(Type.environment, name, environment)
  }

  async readCollection(name) {
    return this.read(Type.collection, name)
  }

  async readEnvironment(name) {
    return this.read(Type.environment, name)
  }

  path(type) {
    if (type === Type.collection) {
      return this.collectionPath
    } else if (type === Type.environment) {
      return this.environmentPath
    }
    throw new Error('unknown type')
  }

  async write(type, name, obj) {
    const path = `${this.path(type)}/${name}.json`
    console.debug(`writing to`, path)
    await fs.writeFile(path, JSON.stringify(obj, null, 4))
  }

  async read(type, name) {
    const path = `${this.path(type)}/${name}.json`
    console.debug('reading', path)
    return await fs.readJson(path)
  }
}