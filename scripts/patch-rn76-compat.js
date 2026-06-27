#!/usr/bin/env node
/**
 * RN 0.76 compatibility patches for expo-dev-client 4.x libraries.
 * expo-dev-menu, expo-dev-menu-interface, and expo-dev-launcher use
 * JSEngineResolutionAlgorithm (removed in RN 0.76) and override methods
 * that became Kotlin properties in PackagerConnectionSettings.
 * Run automatically via postinstall.
 */
const fs = require('fs')
const path = require('path')

const NM = path.join(__dirname, '..', 'node_modules')

function patch(filePath, replacements) {
  const abs = path.join(NM, filePath)
  if (!fs.existsSync(abs)) return
  // Read as buffer to strip BOM before any string work
  let buf = fs.readFileSync(abs)
  if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) buf = buf.slice(3)
  let src = buf.toString('utf8')
  let changed = false
  for (const [from, to] of replacements) {
    if (src.includes(from)) {
      src = src.split(from).join(to)
      changed = true
    }
  }
  if (changed) {
    fs.writeFileSync(abs, src, 'utf8')
    console.log(`patched: ${filePath}`)
  }
}

// expo-dev-menu-interface: remove JSEngineResolutionAlgorithm usage
patch(
  'expo-dev-menu-interface/android/src/main/java/expo/interfaces/devmenu/ReactHostWrapper.kt',
  [
    ['import com.facebook.react.JSEngineResolutionAlgorithm\nimport com.facebook.react.ReactHost',
     'import com.facebook.react.ReactHost'],
    [`      if (isBridgelessMode) {
        return if (reactHost.jsEngineResolutionAlgorithm == JSEngineResolutionAlgorithm.JSC) {
          "JSC"
        } else {
          "Hermes"
        }
      }`,
     `      if (isBridgelessMode) {
        return "Hermes"
      }`],
  ]
)

// expo-dev-menu: PackagerConnectionSettings property override
patch(
  'expo-dev-menu/android/src/main/java/expo/modules/devmenu/react/DevMenuPackagerConnectionSettings.kt',
  [
    ['  override fun getDebugServerHost(): String = serverIp\n\n  override fun setDebugServerHost(host: String) = Unit',
     '  override var debugServerHost: String\n    get() = serverIp\n    set(value) = Unit'],
  ]
)

// expo-dev-menu: JSEngineResolutionAlgorithm usage
patch(
  'expo-dev-menu/android/src/react-native-75/debug/expo/modules/devmenu/DevMenuReactHost.kt',
  [
    ['import com.facebook.react.JSEngineResolutionAlgorithm\nimport com.facebook.react.ReactHost',
     'import com.facebook.react.ReactHost'],
    ['import com.facebook.react.runtime.JSCInstance\nimport com.facebook.react.runtime.ReactHostImpl',
     'import com.facebook.react.runtime.ReactHostImpl'],
    [`    val jsResolutionAlgorithm = createJSEngineResolutionAlgorithm(application)
    val jsRuntimeFactory = if (jsResolutionAlgorithm == JSEngineResolutionAlgorithm.JSC) {
      JSCInstance()
    } else {
      HermesInstance()
    }`,
     '    val jsRuntimeFactory = HermesInstance()'],
    ['      .apply {\n        jsEngineResolutionAlgorithm = jsResolutionAlgorithm\n      }\n', ''],
    [`  private fun createJSEngineResolutionAlgorithm(application: Application): JSEngineResolutionAlgorithm {
    SoLoader.init(application.applicationContext, /* native exopackage */ false)
    if (SoLoader.getLibraryPath("libjsc.so") != null) {
      return JSEngineResolutionAlgorithm.JSC
    }
    return JSEngineResolutionAlgorithm.HERMES
  }

  /**`,
     '  /**'],
  ]
)

// expo-dev-launcher: PackagerConnectionSettings property override
patch(
  'expo-dev-launcher/android/src/main/java/expo/modules/devlauncher/react/DevLauncherPackagerConnectionSettings.kt',
  [
    ['  override fun getDebugServerHost() = serverIp\n\n  override fun setDebugServerHost(host: String) = Unit',
     '  override var debugServerHost: String\n    get() = serverIp\n    set(value) = Unit'],
  ]
)

// expo-dev-launcher: JSEngineResolutionAlgorithm usage
patch(
  'expo-dev-launcher/android/src/react-native-75/debug/expo/modules/devlauncher/launcher/DevLauncherReactHost.kt',
  [
    ['import com.facebook.react.JSEngineResolutionAlgorithm\nimport com.facebook.react.ReactHost',
     'import com.facebook.react.ReactHost'],
    ['import com.facebook.react.runtime.JSCInstance\nimport com.facebook.react.runtime.ReactHostImpl',
     'import com.facebook.react.runtime.ReactHostImpl'],
    [`    val jsResolutionAlgorithm = createJSEngineResolutionAlgorithm(application)
    val jsRuntimeFactory = if (jsResolutionAlgorithm == JSEngineResolutionAlgorithm.JSC) {
      JSCInstance()
    } else {
      HermesInstance()
    }`,
     '    val jsRuntimeFactory = HermesInstance()'],
    ['      .apply {\n        jsEngineResolutionAlgorithm = jsResolutionAlgorithm\n      }\n', ''],
    [`  private fun createJSEngineResolutionAlgorithm(application: Application): JSEngineResolutionAlgorithm {
    SoLoader.init(application.applicationContext, /* native exopackage */ false)
    if (SoLoader.getLibraryPath("libjsc.so") != null) {
      return JSEngineResolutionAlgorithm.JSC
    }
    return JSEngineResolutionAlgorithm.HERMES
  }
}`,
     '}'],
  ]
)

console.log('RN 0.76 compat patches applied.')
