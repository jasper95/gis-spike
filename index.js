global.Promise = require('bluebird')
const archiver = require('archiver');
const fs = require('fs')
const gdal = require('gdal')
const fetch = require('node-fetch')
const JSZip = require('jszip')
const path = require('path')
const Knex = require('knex');
const getGeodata = require('./getGeodata')


Promise.promisifyAll(fs)


async function main() {
  const db = Knex({
    debug: false,
    client: 'postgresql',
    connection: {
      database: 'cenvi',
      host: 'localhost',
      port: 5432,
      user: 'jasper',
      password: 'Passw0rd3'
    },
    pool: {
      min: 2,
      max: 10
    }
  });
  const tableName = 'gis_wew_table';
  const buffer = await fs.readFileAsync('data/man_firehaz.zip')
  // const geojson = JSON.parse(fs.readFileSync('data/result.geojson'));
  const geojson = await getGeodata(buffer)

  geojson2postgis(db, tableName, geojson).then(function (result) {
    console.log(`${result.rowCount} rows inserted`);
    return db.destroy();
  }).catch(function(error) {
    console.error('Error:', error)
  });

  // const kmz_src = 'data/MandaueCity_FireHaz.kmz'
  // const kml_src = 'data/doc.kml'
  // const shapefile_des = 'data/target'
  // const shapefile_name = 'testx'
  // await extractKmz(kmz_src, kml_src)
  // await kmlToShapefile(kml_src, shapefile_des)
  // shapefileToGeojson(kml_src, 'data/result.geojson')
  // const shapefile_name = 'migoooo'
  // const shapefile_final = `${shapefile_des}.zip`
  // await archiveFolder(shapefile_des, shapefile_final)
  // await uploadToGeoServer(shapefile_final, shapefile_name)
}


function shapefileToGeojson(src, des) {
  const ds = gdal.open(src)
  const driver = gdal.drivers.get('GeoJSON')
  const dscopy = driver.createCopy(des, ds, {"COMPRESS":"NONE","TILED": "NONE" })
  ds.close();
  dscopy.close()
}

async function kmlToShapefile(src, des, new_name = 'test') {
  const ds = gdal.open(src)
  const driver = gdal.drivers.get('ESRI Shapefile')
  const dscopy = driver.createCopy(des, ds, {"COMPRESS":"NONE","TILED": "NONE" })
  ds.close();
  dscopy.close()
  const files = await fs.readdirAsync(des)
  return Promise.map(files, fname => {
    const ext = fname.split('.').pop()
    return fs
      .renameAsync(path.join(des, fname), path.join(des, `${new_name}.${ext}`))
  })
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

function geojson2postgis(db, tableName, geojson) {
  const features = geojson.features.map(function getRow(feature) {
    return {
      geom: db.raw(`st_setsrid(st_geomfromgeojson('${JSON.stringify(feature.geometry)}'), 4326)`),
      properties: feature.properties
    };
  });

  return db.schema.createTableIfNotExists(tableName, function (table) {
    table.jsonb('properties').defaultTo('{}');
    table.specificType('geom', 'geometry').notNullable();
  }).then(function () {
    return db(tableName).insert(features);
  });
}

main()