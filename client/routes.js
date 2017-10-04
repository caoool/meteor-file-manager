import React from 'react'
import { FlowRouter } from 'meteor/kadira:flow-router'
import { mount } from 'react-mounter'

import AppContainer from '/client/AppContainer'

FlowRouter.route('/', {
  name: 'index',
  action() {
    mount(AppContainer)
  }
})