global.Promise = require('bluebird')
const archiver = require('archiver');
const fs = require('fs')
const gdal = require('gdal')
const fetch = require('node-fetch')
const JSZip = require('jszip')

Promise.promisifyAll(fs)

async function main() {
  const kmz_src = 'data/MandaueCity_FireHaz.kmz'
  const kml_src = 'data/doc.kml'
  const shapefile_des = 'data/target'
  await extractKmz(kmz_src, kml_src)
  kmlToShapefile(kml_src, shapefile_des)
  const shapefile_name = 'migoooo'
  const shapefile_final = `${shapefile_des}.zip`
  await archiveFolder(shapefile_des, shapefile_final)
  await uploadToGeoServer(shapefile_final, shapefile_name)
}

function kmlToShapefile(src, des) {
  const ds = gdal.open(src)
  const driver = gdal.drivers.get('ESRI Shapefile')
  const dscopy = driver.createCopy(des, ds, {"COMPRESS":"NONE","TILED": "NONE" })
  ds.close();
  dscopy.close();
}

async function extractKmz(src, des) {
  const buffer = await fs.readFileAsync(src)
  const zip = new JSZip();
  const { files } = await zip.loadAsync(buffer)

  const result = await files['doc.kml'].async('nodebuffer')
  return fs.writeFileAsync(des, result)
}

async function uploadToGeoServer(src, datastore) {
  const URL = 'http://localhost:8080/geoserver/rest';
  const WORKSPACE = 'topp';
  const PUBLISHSHAPEURL = `${URL}/workspaces/${WORKSPACE}/datastores/${datastore}/file.shp`;
  const stats = fs.statSync(src);
  const fileSizeInBytes = stats.size;
  const readStream = fs.createReadStream(src);
  const config = {
    headers: {
      Authorization: `Basic ${Buffer.from('admin:geoserver').toString('base64')}`,
      'Content-Type': 'application/zip',
      'Accept': 'application/json',
      "Content-length": fileSizeInBytes,
    },
    method: 'PUT',
    body: readStream
  }
  return fetch(PUBLISHSHAPEURL, config)
}

function archiveFolder(src, des) {
  const zip = archiver('zip');
  const output = fs.createWriteStream(des);
  return new Promise((resolve, reject) => {
    zip.directory(src, '')
    zip.finalize();
    zip.pipe(output)
    zip.on('error', reject)
    zip.on('end', resolve)
  })
}

main()