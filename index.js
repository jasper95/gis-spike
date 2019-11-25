global.Promise = require('bluebird')
const fs = Promise.promisifyAll(require('fs'))
const getGeodata = require('./getGeodata')
const topojson = require('topojson-server')

async function main() {
  let geojson = await fs.readFileAsync('./data/man_firehaz.zip').then(getGeodata)
  const x = topojson.topology({ data: geojson })

  await fs.writeFileAsync('./data/result.json', JSON.stringify(result))
}
main()