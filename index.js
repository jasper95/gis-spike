global.Promise = require('bluebird')
const archiver = require('archiver');
const fs = require('fs')
const gdal = require('gdal')

async function main() {
  const ds = gdal.open('data/doc.kml')
  const driver = gdal.drivers.get('ESRI Shapefile')
  const dscopy = driver.createCopy('data/man_firehaz', ds, {"COMPRESS":"NONE","TILED": "NONE",})
  ds.close();
  dscopy.close();

  const zip = archiver('zip');
  const output = fs.createWriteStream('data/target.zip');
  zip.directory('data/man_firehaz', '')
  zip.finalize();
  zip.pipe(output)
}
main()