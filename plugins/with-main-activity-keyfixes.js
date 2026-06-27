const { withMainActivity } = require('@expo/config-plugins')

// withMainActivity's signature is (config, action). The plugin entry must be a
// ConfigPlugin — a function of `config` — that calls it; passing the action alone
// makes Expo run it during base config resolution where modResults is undefined.
module.exports = function withMainActivityKeyfixes(config) {
  return withMainActivity(config, config => {
    config.modResults.contents = applyFix(config.modResults.contents)
    return config
  })
}

function applyFix(src) {
  // Add KeyEvent import if missing
  if (!src.includes('import android.view.KeyEvent')) {
    src = src.replace(
      'import android.os.Bundle',
      'import android.os.Bundle\nimport android.view.KeyEvent'
    )
  }

  // Add onKeyDown override if missing
  if (!src.includes('override fun onKeyDown')) {
    src = src.replace(
      'override fun invokeDefaultOnBackPressed()',
      `override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {\n    return try { super.onKeyDown(keyCode, event) } catch (_: NullPointerException) { false }\n  }\n\n  override fun invokeDefaultOnBackPressed()`
    )
  }

  return src
}
