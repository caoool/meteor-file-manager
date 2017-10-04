import React, { Component } from 'react'
import { Meteor } from 'meteor/meteor'
import Videos from '/api/videos'
import Dropzone from 'react-dropzone'


export default class Uploader extends Component {
  constructor(props) {
    super(props)
    this.state = {
      files: []
    }
  }

  onDrop = (files) => {
    this.setState({ files })
  }

  upload = () => {
    if (!this.state.files.length) {
      alert('nothing to upload')
      return
    }

    this.state.files.forEach(file => {
      let uploadInstance = Videos.insert({
        file: file,
        streams: 'dynamic',
        chunkSize: 'dynamic'
      }, false);

      uploadInstance.on('end', function(error, fileObj) {
        if (error) {
          window.alert('Error during upload: ' + error.reason);
        } else {
          window.alert('File "' + fileObj.name + '" successfully uploaded');
        }
      });

      uploadInstance.start();
    })
  }

  render() {
    return (
      <section>
        <div className="dropzone">
          <Dropzone onDrop={this.onDrop}>
            <p>Try dropping some files here, or click to select files to upload.</p>
          </Dropzone>
        </div>
        <aside>
          <h2>Dropped files</h2>
          <ul>
            {
              this.state.files.map(f => <li key={f.name}>{f.name} - {f.size} bytes</li>)
            }
          </ul>
        </aside>
        <div className='actionButtons'>
          <button onClick={this.upload}>
            Upload
          </button>
        </div>
      </section>
    )
  }
}