import { Meteor } from 'meteor/meteor'
import { FilesCollection } from 'meteor/ostrio:files'

const Videos = new FilesCollection({
  debug: true,
  collectionName: 'Videos',

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
}

export default Videos