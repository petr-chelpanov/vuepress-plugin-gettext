const EOL = require('os').EOL;
const hasbin = require('hasbin').sync;
const process = require('process');
const util = require('util');
const exec = require('child_process').exec;
const asyncExec = util.promisify(exec);
const {logger, path, fs, chalk} = require('@vuepress/shared-utils');
const gettextMarkdown = require('gettext-markdown');

logger.setOptions({logLevel: 1});

module.exports = (options, context) => ({
  name: 'vuepress-plugin-gettext',

  extendCli(cli) {
    cli
      .command('gettext [targetDir]', '')
      .allowUnknownOptions()
      .action(async (dir = '.') => {
        await getLocales(context, dir);
      })
  }
});

async function getLocales(context, dir) {
  if (false === hasbin('msgmerge')) {
    logger.error('missing required tool ' + chalk.yellowBright('msgmerge'));
    logger.tip('for Windows users visit https://mlocati.github.io/articles/gettext-iconv-windows.html');
    process.exit(1);
  }

  if (false === context.siteConfig.hasOwnProperty('locales')) {
    logger.error('missing required configuration ' + chalk.yellowBright('locales') + ' for ' + chalk.greenBright('VuePress'));
    logger.tip('visit https://v1.vuepress.vuejs.org/guide/i18n.html#site-level-i18n-config for configuration.');
    process.exit(1);
  }

  let configLocales = context.siteConfig.locales;

  if (typeof configLocales !== 'object') {
    logger.error('invalid configuration of ' + chalk.yellowBright('locales'));
    logger.tip('visit https://v1.vuepress.vuejs.org/guide/i18n.html#site-level-i18n-config for configuration.');
    process.exit(1);
  }

  let locales = Object.values(configLocales);

  if (locales.length === 0) {
    logger.error(chalk.yellowBright('locales') + ' list is empty in config of ' + chalk.greenBright('VuePress'));
    logger.tip('visit https://v1.vuepress.vuejs.org/guide/i18n.html#site-level-i18n-config for configuration.');
    process.exit(1);
  }

  let gettextDir = dir + path.sep + '.gettext';

  if (false === fs.existsSync(gettextDir)) {
    fs.mkdirSync(gettextDir);
  }

  if (false === fs.existsSync(gettextDir)) {
    logger.error('cannot create directory ' + chalk.yellowBright(gettextDir));
    process.exit(1);
  }

  let mainPages = [];
  let mainLocale = locales[0];
  let mainLang = mainLocale.lang;
  let mainPath = mainLocale.path;

  for (const page of context.pages) {
    if (page._localePath !== mainPath) {
      continue;
    }

    let pagePath = dir + page._localePath + page.relativePath;

    mainPages.push(pagePath);
  }

  let mainContent = gettextMarkdown.md2pot(mainPages);
  let mainPotFile = gettextDir + path.sep + mainLang + '.pot';

  fs.writeFileSync(mainPotFile, mainContent);
  logger.success(chalk.cyanBright(mainPotFile));

  let regexpFixFuzzy = new RegExp('#, fuzzy', 'g');
  let regexpFixLinks = new RegExp('(\\#\\:\\s+[^\\:]+\\:\\d+) (.+)$', 'gm');
  let regexpFirstDir = new RegExp('^' + dir + '\/');

  for (const locale of locales.slice(1)) {
    let localeLang = locale.lang;
    let localePath = locale.path;
    let localeFile = gettextDir + path.sep + localeLang + '.po';

    if (false === fs.existsSync(localeFile)) {
      let localeTemplate = `#, fuzzy
msgid ""
msgstr ""
"Project-Id-Version: \\n"
"POT-Creation-Date: 2019-07-03 20:29+0000\\n"
"PO-Revision-Date: 2019-06-18 21:35+0300\\n"
"Last-Translator: \\n"
"Language-Team: \\n"
"Language: ` + localeLang + `\\n"
"MIME-Version: 1.0\\n"
"Content-Type: text/plain; charset=UTF-8\\n"
"Content-Transfer-Encoding: 8bit\\n"
"Plural-Forms: nplurals=2; plural=(n != 1);\\n"
`;
      fs.writeFileSync(localeFile, localeTemplate);
    }


    let command = 'msgmerge "' + localeFile + '" "' + mainPotFile + '"';
    let {stdout} = await asyncExec(command, {maxBuffer: 1024 * 1024 * 1024});

    stdout = stdout.replace(regexpFixFuzzy, '');
    stdout = stdout.replace(regexpFixLinks, '$1\r\n\#\: $2');
    stdout = stdout.trim();
    stdout = '#, fuzzy' + EOL + stdout;

    fs.writeFileSync(localeFile, stdout);
    logger.success(chalk.cyanBright(localeFile));

    let result = await gettextMarkdown.po2md(localeFile, stdout);

    result.map((item) => {
      let file = context.sourceDir + localePath + item.fn.replace(regexpFirstDir, '');
      let data = item.data.trim();
      fs.mkdirSync(path.dirname(file), {recursive: true});
      fs.writeFileSync(file, data);
      logger.success(chalk.cyanBright(dir + localePath + item.fn.replace(regexpFirstDir, '')));
    });
  }

  return 1;
}