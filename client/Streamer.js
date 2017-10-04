import React, { Component } from 'react'
import { Meteor } from 'meteor/meteor'
import { withTracker } from 'meteor/react-meteor-data'
import Videos from '/api/videos'


class _Streamer extends Component {
  render() {
    if (!this.props.ready) {
      return (
        <h1>Loading</h1>
      )
    } else {
      return (
        <video height='auto' controls='controls' controlsList='nodownload'>
          <source src={this.props.data.link()} type={this.props.data.type} />
        </video>
      )
    }
  }
}

export default Streamer = withTracker(props => {
  const handler = Meteor.subscribe('files.videos.all')
  const loading = !handler.ready()
  const data = Videos.findOne()
  const ready = !loading && !!data
  return {
    ready,
    data: ready ? data : null
  }
})(_Streamer)