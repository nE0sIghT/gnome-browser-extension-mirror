project('gnome-browser-extension',
  license: 'GPL-3',
  version : '12.1',
)

# Constants
CONTRIB_PATH = meson.global_source_root() / 'contrib'
EXTENSION_PATH = meson.global_source_root() / 'extension'
PO_PATH = meson.global_source_root() / 'po'

EXTENSION_BUILD_DIR = meson.current_build_dir() / 'extension'
CHROME_BUILD_DIR = EXTENSION_BUILD_DIR / 'chrome'
FIREFOX_BUILD_DIR = EXTENSION_BUILD_DIR / 'firefox'

# Copy helper
cp = CONTRIB_PATH / 'cp.py'

# Filter that excludes manifest templates
extension_exclude = 'manifest*.json'

# Build requirements
msgmerge = find_program('msgmerge', required: get_option('build_messages'))
sevenz = find_program('7z', required: get_option('build_source_package'))

if get_option('build_messages')
  py_modules = ['polib']
else
  py_modules = []
endif

py = import('python')
py_install = py.find_installation('python3', required: true, modules: py_modules)

# Chrome Store public extension key
chrome_key = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAlig8TAPPQZinMkJnptC0ldizx6fG9jSjZDJ9c8GuLcXeGRH+NMlQuPC9bR5IQlT7+4VY/1tm1+IZ4xvITx1wXCNTR+KXzZv3VNc2D+logehK7oIRTRj0fLhixrx4NLSNK7L7HgV2xcIoW6QV0jOdFcTPL0mWXodXSzZePrvXuflF7qpwNxLzYVi04Vh3xu2oR2Pc9SwfZ4SNbyCaunH/p8n5AYmDuogI2Ah++RZw0ctnqn7mmHrGXteBu/vkpcHZu3B3eW9PFSrv69rRs8duybYR9C91hJm6yzRqZqIpindIU3k2HnNWeCFWkRVpZPhaNVoxcBUO7wWUUwdIflW2JwIDAQAB'

# Simple python helper that enumerates translations
lang_glob = '''
import glob
import os

os.chdir(os.path.join(os.getenv("MESON_SOURCE_ROOT"), "po"))
print("\n".join([l.split('.')[0] for l in glob.glob("*.po")]), end='')
'''

if get_option('build_extension')
  conf_data = configuration_data()
  conf_data.set('PUBLIC_KEY', chrome_key)

  # Prepare Chrome manifest
  configure_file(
    input: EXTENSION_PATH / 'manifest.json',
    output: 'manifest-chrome.json',
    configuration: conf_data,
    format: 'cmake',
  )

  # Prepare Firefox manifest
  configure_file(
    input: [
      EXTENSION_PATH / 'manifest.json',
      EXTENSION_PATH / 'manifest.firefox.json',
    ],
    output: 'manifest-firefox.json',
    command: [
      py_install.path(),
      CONTRIB_PATH / 'merge_json.py',
      '--delete', 'key,externally_connectable',
      '--output', '@OUTPUT@',
      '@INPUT@'
    ],
  )

  # Build Chrome extension
  run_command(
    py_install.path(),
    cp,
    '--rename', 'manifest.json',
    meson.current_build_dir() / 'manifest-chrome.json',
    CHROME_BUILD_DIR,
    check: true,
  )
  run_command(
    py_install.path(),
    cp,
    '--ignore', extension_exclude,
    EXTENSION_PATH,
    CHROME_BUILD_DIR,
    check: true,
  )
  run_command(
    py_install.path(),
    cp,
    '--es6-module',
    '--rename', 'constants-script.js',
    EXTENSION_PATH / 'include/constants.js',
    CHROME_BUILD_DIR / 'include',
    check: true,
  )
  custom_target('chrome-zip',
    command: [
      sevenz, 'a', '-tzip',
      meson.current_build_dir() / 'extension-chrome.zip',
      CHROME_BUILD_DIR / '*',
    ],
    output: 'extension-chrome.zip',
    build_by_default: true,
  )

  # Build Firefox extension
  run_command(
    py_install.path(),
    cp,
    '--rename', 'manifest.json',
    meson.current_build_dir() / 'manifest-firefox.json',
    FIREFOX_BUILD_DIR,
    check: true,
  )
  run_command(
    py_install.path(),
    cp,
    '--ignore', extension_exclude,
    EXTENSION_PATH,
    FIREFOX_BUILD_DIR,
    check: true,
  )
  run_command(
    py_install.path(),
    cp,
    '--es6-module',
    '--rename', 'constants-script.js',
    EXTENSION_PATH / 'include/constants.js',
    FIREFOX_BUILD_DIR / 'include',
    check: true,
  )
  custom_target('firefox-zip',
    command: [
      sevenz, 'a', '-tzip',
      meson.current_build_dir() / 'extension-firefox.zip',
      FIREFOX_BUILD_DIR / '*',
    ],
    output: 'extension-firefox.zip',
    build_by_default: true,
  )
endif

if get_option('build_messages')
  messages_deps = []

  # Update gettext's pot template from Chrome's messages.json
  run_command(
    py_install.path(),
    meson.global_source_root() / 'contrib/chrome-messages2po.py',
    '--email', get_option('gettext_report_email'),
    '--reference-lang', 'en',
    '--write-pot',
    meson.global_source_root() / 'contrib/chrome-web-store/',
    meson.global_source_root() / 'extension/_locales/',
    meson.global_source_root() / 'po/',
    check: true,
  )

  # Update *.po from generated template
  langs = run_command(py_install.path(), '-c', lang_glob, check: true).stdout().split('\n')
  foreach lang : langs
    run_command(
      msgmerge, '-q', '--update',
      PO_PATH / lang + '.po',
      PO_PATH / 'gnome-browser-extension.pot',
      check: true,
    )
  endforeach

  # Regenerate extension locales
  run_command(
    py_install.path(),
    CONTRIB_PATH / 'po2chrome-messages.py',
    '--reference-lang', 'en',
    CONTRIB_PATH / 'chrome-web-store/',
    meson.global_source_root() / 'extension' / '_locales/',
    PO_PATH,
    check: true,
  )
endif
