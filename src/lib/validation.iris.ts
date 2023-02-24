import _ from 'lodash'
import { getReservedNames, MANAGED_EXCHANGES } from './constants'
import flags from './flags'
import { ValidationError } from './validation.interfaces'

const { DEAD_LETTER } = MANAGED_EXCHANGES

const VALIDATION_PATTERNS = {
  TOPIC_PATTERN: /^([#*]|[\da-z-]+)(\.([#*]|[\da-z-]+))*$/,
  KEBAB_CASE_PATTERN: /^([a-z][\da-z]*)(\/)?(-[\da-z]+)*$/,
}

export function throwIfValueIsInvalidCaseFormat(name: string, errorTag: string, nameTag: string, useTopicPattern: boolean = false): void {
  const valueToCheck = name.replace(DEAD_LETTER.PREFIX, '')
  const isReservedName = getReservedNames().includes(valueToCheck)

  if (isReservedName) {
    if (!flags.ALLOW_USING_RESERVED_NAMES) {
      throw new ValidationError(errorTag, `${nameTag} is is invalid, because it's using reserved word: ${valueToCheck}`, { name })
    } else {
      return
    }
  }

  const pattern: keyof typeof VALIDATION_PATTERNS = useTopicPattern ? 'TOPIC_PATTERN' : 'KEBAB_CASE_PATTERN'
  const regex = VALIDATION_PATTERNS[pattern]
  if (!regex.test(valueToCheck)) {
    throw new ValidationError(
      errorTag,
      `${nameTag} is is invalid.\nFor TOPIC messages allowed format is kebab case with additional characters: '.#*'\nFor all others it should only be kebab case.`,
      { name }
    )
  }
}
