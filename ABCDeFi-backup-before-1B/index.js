/**
 * @format
 */
import '@walletconnect/react-native-compat'
import 'react-native-get-random-values'
import 'react-native-url-polyfill/auto'

import { Buffer } from 'buffer'
import process from 'process'

global.Buffer = Buffer
global.process = process

import { AppRegistry } from 'react-native'
// import App from './App'
import App from './src/App'
import { name as appName } from './app.json'

AppRegistry.registerComponent(appName, () => App)