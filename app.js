#!/usr/bin/env node

const Axios = require("axios");
const fs = require("fs-extra");
const prompts = require("prompts");

const apiUrl = 'https://api.getpostman.com'
const configFileName = 'personal'
const envPath = './environments/'
const collectionPath = './collections/'

async function main() {
  const action = process.argv[2]

  if (action === 'init') {
    //Prompt to input apiKey
    const result = await prompts({
      type: 'text',
      name: 'value',
      message: 'What is your API Key?',
    })
    const apiKey = result.value
    //Save config
    await fs.writeJson(`./${configFileName}.json`, {apiKey})
    console.info(`${configFileName}.json created`)

    if (!await fs.exists(collectionPath)) {
      await fs.mkdirs(collectionPath)
      await fs.writeFile(`${collectionPath}README.md`, "Put your collection json in this folder, and then `postmgn import`")
    }
    if (!await fs.exists(envPath)) {
      await fs.mkdirs(envPath)
      //Create readme for env
      await fs.writeFile(`${envPath}README.md`, "Put your environment json in this folder, and then `postmgn import`")
    }

    console.info("You can now put your json into collections/ and environments/ and then `postmgn import`")

    return
  }

  let personal = {}
  try {
    personal = await fs.readJson(`./${configFileName}.json`)
  } catch (err) {
    throw new Error('Please `postmgn init` the project')
  }

  const axios = Axios.create({
    baseURL: apiUrl,
    headers: {
      "X-Api-Key": personal.apiKey
    }
  })

  if (action === 'export') {
    if (!personal.collections) {
      throw new Error("You have to run import first")
    }
    //Export from postman
    const collectionUids = Object.keys(personal.collections)
    console.info('collections=', collectionUids)
    const collectionPromises = collectionUids.map(uid => axios.get(`/collections/${uid}`))

    const environmentUids = Object.keys(personal.environments)
    console.info('environments=', environmentUids)
    const environmentPromises = environmentUids.map(uid => axios.get(`/environments/${uid}`))

    const collectionRess = await Promise.all(collectionPromises)
    const environmentRess = await Promise.all(environmentPromises)

    async function saveFiles(ress, basePath, filenameFn) {
      for (const [idx, res] of ress.entries()) {
        const filename = filenameFn(idx)
        const path = `${basePath}${filename}.json`
        if (res.data) {
          console.debug('exporting ', res.data)
          await fs.writeFile(path, JSON.stringify(res.data, null, 4))
          console.info('write to file ', path)
        } else {
          console.error(`Error saving ${path}: content should not be empty`)
        }
      }
    }

    await saveFiles(environmentRess, envPath, (idx) => personal.environments[environmentUids[idx]])
    await saveFiles(collectionRess, collectionPath, (idx) => personal.collections[collectionUids[idx]])
  } else if (action === 'import') {
    //Import to postman
    async function readFilesAndSubmit(basePath, mapping, warpKey, resourceApiPath, remoteResources, idFn) {
      let files = await fs.readdir(basePath)
      files = files.filter(name => name.endsWith('.json'))

      console.info('files=', files)
      console.info('mapping=', mapping)

      const revMapping = Object.entries(mapping).reduce((a, b) => {
        a[b[1]] = b[0]
        return a
      }, {})

      for (const filename of files) {
        const path = `${basePath}${filename}`
        let json = await fs.readJson(path)
        if (!json[warpKey]) {
          //it is just generated by postman, not from postman api
          json = {[warpKey]: json}
          //Update file
          await fs.writeFile(path, JSON.stringify(json, null, 4))
        }

        const uid = revMapping[filename]
        if (uid) {
          console.debug('updating', json)
          const res = await axios.put(`${resourceApiPath}/${uid}`, json)
          console.info('updated', res.data[warpKey])
        } else {
          const remote = remoteResources.find(r => r.id === idFn(json))

          if (remote) {
            console.debug('updating', json)
            const res = await axios.put(`${resourceApiPath}/${remote.uid}`, json)
            console.info('updated', res.data[warpKey])
            mapping[remote.uid] = filename.slice(0, filename.length - 5); //trim .json
          } else {
            console.debug('creating', json)
            const res = await axios.post(`${resourceApiPath}`, json)
            console.info('created', res.data[warpKey])
            mapping[res.data[warpKey].uid] = filename.slice(0, filename.length - 5); //trim .json
          }
        }
      }
    }

    const remoteCollections = await axios.get('/collections')
    const remoteEnvironments = await axios.get('/environments')

    personal.collections = personal.collections || {}
    await readFilesAndSubmit(collectionPath, personal.collections, 'collection', '/collections', remoteCollections.data.collections, (json) => json.collection.info._postman_id)
    personal.environments = personal.environments || {}
    await readFilesAndSubmit(envPath, personal.environments, 'environment', '/environments', remoteEnvironments.data.environments, (json) => json.environment.id)

    await fs.writeFile(`./${configFileName}.json`, JSON.stringify(personal, null, 4))
    console.log(`Updated ${configFileName}.json`)
  } else {
    console.info('usage: postmgn [import | export | init]')
  }
}

main()
