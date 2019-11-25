import EventSource from 'eventsource'

import { TriggerBinderConfig } from './load-config'

interface BuildServerResponse {
  phase: string
  message: string
  [propName: string]: any
}

export const requestBuild = async (
  url: string,
  debug: boolean
): Promise<void> => {
  const timeOut = 30000
  const startTime = new Date().getTime()
  const source = new EventSource(url)

  source.onmessage = ((event: MessageEvent) => {
    const eventData = JSON.parse(event.data) as BuildServerResponse
    if (debug) {
      console.log(`BuildServerResponse(${url}): \n${eventData.message}\n`)
    }
    if (checkDone(startTime, timeOut, eventData)) {
      if (['launching', 'ready'].indexOf(eventData.phase) > -1) {
        console.log('\nYour binder build is done.\n')
      } else if (eventData.phase === 'building') {
        console.log('\nBinder build started.\nCheck back soon.\n')
      } else {
        source.close()
        throw new Error(
          `Your binder build failed with the following
          message:\n${eventData.message}`
        )
      }
      source.close()
    }
  }) as EventListener

  source.onerror = (event: MessageEvent) => {
    source.close()
    throw new Error(`An Error occurred requesting a binder build at:\n
    ${url}\n\n${event.data}`)
  }
}

const checkDone = (
  startTime: number,
  timeOut: number,
  eventData: BuildServerResponse
): boolean => {
  if (
    new Date().getTime() - startTime > timeOut &&
    eventData.phase === 'building'
  ) {
    return true
  } else if (['launching', 'ready', 'failed'].indexOf(eventData.phase) > -1) {
    return true
  } else {
    return false
  }
}

export const triggerBuilds = (config: TriggerBinderConfig): void => {
  const baseUrls: string[] = [
    'https://gke.mybinder.org/build',
    'https://ovh.mybinder.org/build'
    // 'http://localhost:8000'
  ]
  const targetRepo: string = config.targetRepo
  const targetState: string = config.targetState
  const serviceName: string = config.serviceName
  for (let baseUrl of baseUrls) {
    let url: string = `${baseUrl}/${serviceName}/${targetRepo}`
    if (targetState !== '') {
      url += '/' + targetState
    }
    console.log(url)
    requestBuild(url, config.debug).catch(reason => {
      console.error(reason)
    })
  }
}
