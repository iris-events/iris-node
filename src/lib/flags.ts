import * as helper from './helper'

const IRIS_DISABLE_RETRY = 'IRIS_DISABLE_RETRY'
const IRIS_DISABLE_MESSAGE_CONSUME_VALIDATION =
  'DISABLE_MESSAGE_CONSUME_VALIDATION'
const IRIS_DISABLE_MESSAGE_PRODUCE_VALIDATION =
  'DISABLE_MESSAGE_PRODUCE_VALIDATION'

// only for internal use during tests
let ALLOW_USING_RESERVED_NAMES = false

// do not create exchanges for messages
// where scope is not `internal`
let ASSERT_NON_INTERNAL_EXCHANGES = false

const flags = {
  get DISABLE_RETRY(): boolean {
    return helper.isEnvTrue(process.env[IRIS_DISABLE_RETRY])
  },
  set DISABLE_RETRY(flag: boolean) {
    process.env[IRIS_DISABLE_RETRY] = helper.getEnvBoolFlag(flag)
  },
  get DISABLE_MESSAGE_CONSUME_VALIDATION(): boolean {
    return helper.isEnvTrue(
      process.env[IRIS_DISABLE_MESSAGE_CONSUME_VALIDATION],
    )
  },
  set DISABLE_MESSAGE_CONSUME_VALIDATION(flag: boolean) {
    process.env[IRIS_DISABLE_MESSAGE_CONSUME_VALIDATION] =
      helper.getEnvBoolFlag(flag)
  },
  get DISABLE_MESSAGE_PRODUCE_VALIDATION(): boolean {
    return helper.isEnvTrue(
      process.env[IRIS_DISABLE_MESSAGE_PRODUCE_VALIDATION],
    )
  },
  set DISABLE_MESSAGE_PRODUCE_VALIDATION(flag: boolean) {
    process.env[IRIS_DISABLE_MESSAGE_PRODUCE_VALIDATION] =
      helper.getEnvBoolFlag(flag)
  },
  get ALLOW_USING_RESERVED_NAMES(): boolean {
    return ALLOW_USING_RESERVED_NAMES
  },
  set ALLOW_USING_RESERVED_NAMES(flag: boolean) {
    ALLOW_USING_RESERVED_NAMES = flag
  },
  get ASSERT_NON_INTERNAL_EXCHANGES(): boolean {
    return ASSERT_NON_INTERNAL_EXCHANGES
  },
  set ASSERT_NON_INTERNAL_EXCHANGES(flag: boolean) {
    ASSERT_NON_INTERNAL_EXCHANGES = flag
  },
}

export default flags
