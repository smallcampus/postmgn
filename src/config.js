import fs from "fs-extra"

const legacyPath = 'personal.json'

export class Config {

  constructor(personalPath = 'postmgn.private.config', publicPath = 'postmgn.config') {
    this.personalPath = personalPath
    this.publicPath = publicPath
  }

  async init() {
    try {
      this.personal = await fs.readJson(this.personalPath) || {}
    } catch (e) {
      this.personal = {}
    }
    try {
      this.public = await fs.readJson(this.publicPath) || {}
    } catch (e) {
      this.public = {}
    }
    try {
      this.legacy = await fs.readJson(legacyPath) || {}
    } catch (e) {
      this.legacy = {}
    }
  }

  setApiKey(apiKey) {
    this.personal.apiKey = apiKey
  }

  setCollectionPath(path) {
    this.public.collectionPath = path
  }

  setEnvironmentPath(path) {
    this.public.environmentPath = path
  }

  addCollection(name, uid) {
    this.addObject('collections', name, uid)
  }

  addEnvironment(name, uid) {
    this.addObject('environments', name, uid)
  }

  addObject(type, name, uid) {
    this.public[type] = this.public[type] || []
    this.public[type].push(name)

    this.personal[type] = this.personal[type] || {}
    this.personal[type][name] = uid
  }

  async ensureIgnoreSecretFile(path) {
    try {
      const ignore = await fs.readFile('.gitignore', 'utf8')
      console.log(ignore)

      const regex = new RegExp(`^${path}$`, 'm')
      if (!regex.test(ignore)) {
        throw new Error('must ignore private file')
      }
    } catch (e) {
      await fs.appendFile('.gitignore', `\n${path}`)
      console.info('appended ', path, ' to .gitignore')
    }
  }

  async save() {
    await this.ensureIgnoreSecretFile(this.personalPath)
    fs.writeFile(this.personalPath, JSON.stringify(this.personal, null, 4))
    console.info(this.personalPath, 'saved')
    fs.writeFile(this.publicPath, JSON.stringify(this.public, null, 4))
    console.info(this.publicPath, 'saved')
  }
}