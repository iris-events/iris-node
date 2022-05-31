import * as os from 'os'
import * as _ from 'lodash'

let serviceName: string = '{SERVICE_NAME}'

export function setServiceName(sName: string): void {
  serviceName = _.kebabCase(sName)
}
export function getServiceName(): string {
  return serviceName
}

export function getHostName(): string {
  return os.hostname()
}
export function getConsumerTag(postfixTag: string): string {
  return `${getServiceName()}@${getHostName()}#${postfixTag}`
}

export function isEnvTrue(value?: string): boolean {
  return value === undefined ? false : ['1', 'true'].includes(`${value}`.toLowerCase())
}

export function getEnvBoolFlag(flag: boolean): string {
  return flag ? 'true' : 'false'
}

export function nonemptyString(arg: unknown): arg is string {
  return _.isString(arg) && !_.isEmpty(arg)
}

export function getTargetConstructor(target: Object | Function): Function {
  return target instanceof Function ? target : target.constructor
}

export function classIsSameOrSubclassOf(classToCheck: Function, classToCompareTo: Function): boolean {
  return classToCheck === classToCompareTo || classToCheck.prototype instanceof classToCompareTo
}
