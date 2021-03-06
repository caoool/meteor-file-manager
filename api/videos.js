import { Meteor } from 'meteor/meteor'
import { FilesCollection } from 'meteor/ostrio:files'
import { _ } from 'meteor/underscore'
import { Random } from 'meteor/random'
import stream from 'stream'
import fs from 'fs'
import S3 from 'aws-sdk/clients/s3'


const s3Conf = {
  key: 'AKIAIDK5T4MFSTG75QUA',
  secret: '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',
  bucket: 'ideas-lcs',
  region: 'ap-northeast-2'
}
const bound = Meteor.bindEnvironment((callback) => {
  return callback()
})
const s3 = new S3({
  secretAccessKey: s3Conf.secret,
  accessKeyId: s3Conf.key,
  region: s3Conf.region,
  sslEnabled: false,
  httpOptions: {
    timeout: 6000,
    agent: false
  }
});

const Videos = new FilesCollection({
  debug: true,
  storagePath: 'assets/app/uploads/Videos',
  collectionName: 'Videos',
  allowClientCode: false,

  // Start moving files to AWS:S3
  // after fully received by the Meteor server
  onAfterUpload(fileRef) {
    // Run through each of the uploaded file
    _.each(fileRef.versions, (vRef, version) => {
      // We use Random.id() instead of real file's _id
      // to secure files from reverse engineering on the AWS client
      const filePath = 'files/' + (Random.id()) + '-' + version + '.' + fileRef.extension;

      // Create the AWS:S3 object.
      // Feel free to change the storage class from, see the documentation,
      // `STANDARD_IA` is the best deal for low access files.
      // Key is the file name we are creating on AWS:S3, so it will be like files/XXXXXXXXXXXXXXXXX-original.XXXX
      // Body is the file stream we are sending to AWS
      s3.putObject({
        // ServerSideEncryption: 'AES256', // Optional
        StorageClass: 'STANDARD',
        Bucket: s3Conf.bucket,
        Key: filePath,
        Body: fs.createReadStream(vRef.path),
        ContentType: vRef.type,
      }, (error) => {
        bound(() => {
          if (error) {
            console.error(error);
          } else {
            // Update FilesCollection with link to the file at AWS
            const upd = { $set: {} };
            upd['$set']['versions.' + version + '.meta.pipePath'] = filePath;

            this.collection.update({
              _id: fileRef._id
            }, upd, (updError) => {
              if (updError) {
                console.error(updError);
              } else {
                // Unlink original files from FS after successful upload to AWS:S3
                this.unlink(this.collection.findOne(fileRef._id), version);
              }
            });
          }
        });
      });
    });
  },

  // Intercept access to the file
  // And redirect request to AWS:S3
  interceptDownload(http, fileRef, version) {
    let path;

    if (fileRef && fileRef.versions && fileRef.versions[version] && fileRef.versions[version].meta && fileRef.versions[version].meta.pipePath) {
      path = fileRef.versions[version].meta.pipePath;
    }

    if (path) {
      // If file is successfully moved to AWS:S3
      // We will pipe request to AWS:S3
      // So, original link will stay always secure

      // To force ?play and ?download parameters
      // and to keep original file name, content-type,
      // content-disposition, chunked "streaming" and cache-control
      // we're using low-level .serve() method
      const opts = {
        Bucket: s3Conf.bucket,
        Key: path
      };

      if (http.request.headers.range) {
        const vRef  = fileRef.versions[version];
        let range   = _.clone(http.request.headers.range);
        const array = range.split(/bytes=([0-9]*)-([0-9]*)/);
        const start = parseInt(array[1]);
        let end     = parseInt(array[2]);
        if (isNaN(end)) {
          // Request data from AWS:S3 by small chunks
          end       = (start + this.chunkSize) - 1;
          if (end >= vRef.size) {
            end     = vRef.size - 1;
          }
        }
        opts.Range   = `bytes=${start}-${end}`;
        http.request.headers.range = `bytes=${start}-${end}`;
      }

      const fileColl = this;
      s3.getObject(opts, function (error) {
        if (error) {
          console.error(error);
          if (!http.response.finished) {
            http.response.end();
          }
        } else {
          if (http.request.headers.range && this.httpResponse.headers['content-range']) {
            // Set proper range header in according to what is returned from AWS:S3
            http.request.headers.range = this.httpResponse.headers['content-range'].split('/')[0].replace('bytes ', 'bytes=');
          }

          const dataStream = new stream.PassThrough();
          fileColl.serve(http, fileRef, fileRef.versions[version], version, dataStream);
          dataStream.end(this.data.Body);
        }
      });

      return true;
    }
    // While file is not yet uploaded to AWS:S3
    // It will be served file from FS
    return false;
  },

  onbeforeunloadMessage() {
    return 'Upload is still in progress! Upload will be aborted if you leave this page!'
  },

  onBeforeUpload(file) {
    if (file.size <= 1024*1024*100 && /mp4/i.test(file.ext)) {
      return true
    } else {
      return 'Please upload mp4, with size equal or less than 100MB'
    }
  },

  downloadCallback(fileObj) {
    if (this.params.query.download == 'true') {
      Videos.update(fileObj._id, {$inc: {'meta.downloads': 1}})
    }
    return true
  },
})

if (Meteor.isServer) {
  Videos.denyClient();
  Meteor.publish('files.videos.all', function () {
    return Videos.find().cursor
  })

  const _origRemove = Videos.remove;
  Videos.remove = function (search) {
    const cursor = this.collection.find(search);
    cursor.forEach((fileRef) => {
      _.each(fileRef.versions, (vRef) => {
        if (vRef && vRef.meta && vRef.meta.pipePath) {
          // Remove the object from AWS:S3 first, then we will call the original FilesCollection remove
          s3.deleteObject({
            Bucket: s3Conf.bucket,
            Key: vRef.meta.pipePath,
          }, (error) => {
            bound(() => {
              if (error) {
                console.error(error);
              }
            });
          });
        }
      });
    });

    //remove original file from database
    _origRemove.call(this, search);
  }
}

export default Videos