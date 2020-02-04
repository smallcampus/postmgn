import {PostmanApi} from "./postmanApi"
import inquirer from 'inquirer'
import {Config} from "./config";
import {FileModule} from "./file";

const prompt = inquirer.createPromptModule();

export class App {

  constructor() {
  }

  async init() {
    const action = process.argv[2]
    const debug = process.argv.includes('--debug')
    this.apiKey = process.env.POSTMAN_API_KEY
    this.config = new Config()
    await this.config.init()

    if (!this.apiKey && this.config.personal.apiKey) {
      this.apiKey = this.config.personal.apiKey
    }

    if (!this.apiKey) {
      const postmanApiKey = await this.promptPostmanApiKey()
      this.apiKey = postmanApiKey
      this.config.setApiKey(postmanApiKey)
      await this.config.save()
    }
    this.api = new PostmanApi(this.apiKey)

    if ((this.config.public.collections || []).length === 0 && (this.config.public.environments || []).length === 0) {
      //Check it has legacy config
      if (this.config.legacy.apiKey) {
        await this.migrateLegacyConfig()
      } else {
        //Empty Project (First time Export)
        await this.initExport()
        return
      }
    }

    if (action) {
      if (action === 'im' || action === 'import') {
        await this.doImport()
        return
      } else if (action === 'ex' || action === 'export') {
        await this.doExport()
        return
      }
    } else {
      //Check all linkage exist
      const remoteCollections = this.config.public.collections || []
      const collectionMap = this.config.personal.collections || {}
      const remoteEnvironments = this.config.public.environments || []
      const environmentMap = this.config.personal.environments || {}

      let needImport = false
      needImport = this._checkDiff(needImport, 'collection', remoteCollections, collectionMap)
      needImport = this._checkDiff(needImport, 'environment', remoteEnvironments, environmentMap)

      if (needImport) {
        if (await this.promptConfirmImportChanges()) {
          await this.doImport()
        }
      }
    }
    // Main Command Loop
    // TODO Commands
    // 1. Export all
    // 2. Import all
    // 3. Merge?
    // 4. Add new collections
    // 5. Add new environments
    // 6. Remove collection
    // 7. Remove environment

    console.info('usage: postmgn [import | export]')
  }

  /**
   * Check if remote (change from git remote) has more document than local
   * @param needImport
   * @param type
   * @param remotes
   * @param locals
   * @returns Boolean need to import or not
   * @private
   */
  _checkDiff(needImport, type, remotes, locals) {
    for (const name of remotes) {
      if (!locals[name]) {
        needImport = true
        console.info(type, name, 'is added.')
      }
    }
    return needImport
  }

  async migrateLegacyConfig() {
    this.config.personal = this.config.legacy
    const collections = Object.values(this.config.personal.collections || {})
    const environments = Object.values(this.config.personal.environments || {})

    this.config.public = {
      collections,
      environments
    }

    await this.config.save()
    console.info('Migrated legacy config.')
  }

  async doExport() {
    const remoteCollections = this.config.public.collections || []
    const collectionMap = this.config.personal.collections || {}
    const remoteEnvironments = this.config.public.environments || []
    const environmentMap = this.config.personal.environments || {}

    const collectionPath = this.config.public.collectionPath || 'collections'
    const environmentPath = this.config.public.environmentPath || 'environments'
    const fileModule = new FileModule(collectionPath, environmentPath)

    await this._doExport(fileModule, 'collection', 'collections', remoteCollections, collectionMap)
    await this._doExport(fileModule, 'environment', 'environments', remoteEnvironments, environmentMap)

    console.info('Export completed.')
  }

  async _doExport(fileModule, type, typeS, remotes, locals) {
    for (const name of remotes) {
      const uid = locals[name]
      if (uid) {
        const doc = await this.api.get(this.api.type(type), uid)
        console.debug(doc)
        await fileModule.write(fileModule.type(type), name, doc)
      }
    }
  }

  async doImport() {
    const remoteCollections = this.config.public.collections || []
    const collectionMap = this.config.personal.collections || {}
    const remoteEnvironments = this.config.public.environments || []
    const environmentMap = this.config.personal.environments || {}

    const collectionPath = this.config.public.collectionPath || 'collections'
    const environmentPath = this.config.public.environmentPath || 'environments'
    const fileModule = new FileModule(collectionPath, environmentPath)

    if (!(await this.promptConfirmImport(remoteCollections, remoteEnvironments))) {
      console.info('Import aborted')
      return
    }

    await this._doImport(fileModule, 'collection', 'collections', remoteCollections, collectionMap)
    await this._doImport(fileModule, 'environment', 'environments', remoteEnvironments, environmentMap)

    console.debug('Config=', this.config)
    await this.config.save()
    console.info('Import completed.')
  }

  async _doImport(fileModule, type, typeS, remotes, locals) {
    for (let i = 0; i < remotes.length; i++) {
      const name = remotes[i]
      console.debug('Importing', type, name)
      const uid = locals[name]
      const json = await fileModule.read(fileModule.type(type), name)
      if (uid) {
        //Update
        await this.api.update(this.api.type(type), uid, json)
        console.info('Updated', type, name, uid)
      } else {
        //Create
        const result = await this.api.create(this.api.type(type), json)
        console.debug('Postman return', result)
        const newId = result[type].uid
        this.config.addObject(typeS, name, newId)
        console.info('Created ', type, ' for', name, newId)
      }
    }
  }

  async initExport() {
    // Get all collections from postman api and choose some to version control
    const collections = await this.selectCollections()
    console.log(collections)

    // Get all environments from postman api and choose some to version control
    const environments = await this.selectEnvironments()
    console.log(environments)

    const collectionPath = await this.promptCollectionPath()
    const environmentPath = await this.promptEnvironmentPath()
    this.config.setCollectionPath(collectionPath)
    this.config.setEnvironmentPath(environmentPath)

    const fileModule = new FileModule(collectionPath, environmentPath)

    await fileModule.ensureDirectoryExist()

    for (const collection of collections) {
      const doc = await this.api.getCollection(collection.uid)
      console.debug(doc)
      const name = collection.name + '_' + collection.id.substring(0, 8)
      this.config.addCollection(name, collection.uid)
      await fileModule.writeCollection(name, doc)
    }

    for (const environment of environments) {
      const doc = await this.api.getEnvironment(environment.uid)
      console.debug(doc)
      const name = environment.name + '_' + environment.id.substring(0, 8)
      this.config.addEnvironment(name, environment.uid)
      await fileModule.writeEnvironment(name, doc)
    }

    console.debug(this.config)
    await this.config.save()
  }

  async promptPostmanApiKey() {
    //https://gtspecialdutyunit.postman.co/settings/me/api-keys
    const {apiKey} = await prompt({
      type: 'input',
      name: 'apiKey',
      message: 'What is your Postman API Key?'
    })
    return apiKey
  }

  async promptConfirmImportChanges() {
    const {confirm} = await prompt({
      type: 'input',
      name: 'confirm',
      message: 'Do you want to import now? [Y/n]'
    })
    return (confirm || 'y').toLowerCase() === 'y'
  }

  async promptConfirmImport(collections, environments) {
    const message = 'You are going to import the follow resources:\n' +
      collections.map(c=>`Collection: ${c}\n`) +
      environments.map(e=>`Environment: ${e}\n`) +
      'This will overwrite your postman collections, are you sure? [y/N]'
    const {confirm} = await prompt({
      type: 'input',
      name: 'confirm',
      message: message
    })
    return (confirm || 'n').toLowerCase() === 'y'
  }

  async promptCollectionPath() {
    const {path} = await prompt({
      type: 'input',
      name: 'path',
      message: 'Where do you want to save exported collections? [collections]'
    })

    return path || 'collections'
  }

  async promptEnvironmentPath() {
    const {path} = await prompt({
      type: 'input',
      name: 'path',
      message: 'Where do you want to save exported environments? [environments]'
    })
    return path || 'environments'
  }

  async selectCollections() {
    const collections = await this.api.listCollections()

    return await this.promptSelectCollections(collections)
  }

  async promptSelectCollections(collections) {
    const choices = collections.map((c) => {
      return {name: c.name, value: c}
    })
    const {chosenCollections} = await prompt({
      type: 'checkbox',
      name: 'chosenCollections',
      message: 'Please choose some collections you want to version control:',
      choices: choices
    })
    return chosenCollections
  }

  async selectEnvironments() {
    const environments = await this.api.listEnvironments()

    return await this.promptSelectEnvironments(environments)
  }

  async promptSelectEnvironments(environments) {
    const choices = environments.map((c) => {
      return {name: c.name, value: c}
    })
    const {chosenEnvironments} = await prompt({
      type: 'checkbox',
      name: 'chosenEnvironments',
      message: 'Please choose some environments you want to version control:',
      choices: choices
    })
    return chosenEnvironments
  }
}
