import * as iris from '../src'
import * as testing from '../src/testing'

iris.helper.setServiceName('iris_node_tests')
iris.flags.ALLOW_USING_RESERVED_NAMES = true
iris.flags.ASSERT_NON_INTERNAL_EXCHANGES = true

testing.utilities.setLogLevel()

export { testing as irisTesting }
