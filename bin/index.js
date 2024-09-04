#!/usr/bin/env node

import { Command, Option } from 'commander';
import { createRequire } from 'module';
import fs from 'fs';
import { execSync } from 'child_process';
import dayjs from 'dayjs';

const __dirname = new URL('../', import.meta.url).pathname;
const require = createRequire(__dirname);
const pkg = require('./package.json');
const cwdPkg = require(`${process.cwd()}/package.json`);
const program = new Command();

program.version(pkg.version);
program
  .addOption(new Option('-v, --verbose', 'show verbose log'))
  .addOption(new Option('-i, --init', 'init gmaConfig to package.json'))
  .addOption(new Option('-b, --branch', 'branch name'))
  .addOption(new Option('-f, --file', 'file name to save'))
  .parse(process.argv);

/**
 * @help: git-message-analyst -h
 * @description: git-message-analyst -f
 */

class CliApp {
  constructor() {
    this.args = program.args;
    this.opts = program.opts();
  }

  get currentBranch() {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
  }

  log(...args) {
    const { verbose } = this.opts;
    if (verbose) console.log('📗', ...args);
  }

  init() {
    // set gmaConfig to package.json
    const gmaConfig = JSON.stringify({
      dateStart: '2024-09-01',
      dateEnd: dayjs().format('YYYY-MM-DD'),
      startWith: 'notes:',
      saveAs: 'git-commit-analysis.md',
      branch: 'main',
    });
    execSync(`npm pkg set  --json gmaConfig='${gmaConfig}'`, { encoding: 'utf-8' });
  }

  run() {
    if (!cwdPkg.gmaConfig && !this.opts.init) {
      console.log('Please run `gma init` first.');
      return;
    }

    if (this.opts.init) {
      this.init();
      return;
    }

    const { dateStart, dateEnd, startWith, saveAs, branch } = pkg.gmaConfig;
    const endData = dateEnd || dayjs().format('YYYY-MM-DD');
    const calcBranch = branch || this.opts.branch || this.currentBranch;

    // 用数组维护命令的各个部分
    const commandParts = [
      'git log',
      `${calcBranch}`,
      `--since="${dateStart}"`,
      `--until="${endData}"`,
      '--pretty=format:\'{"author": "%an", "message": "%s", "date": "%ad"},\'',
      "--date=format:'%Y-%m-%d %H:%M:%S'",
      `| grep '^.*${startWith}'`,
      "| sed '$ s/,$//'",
      '| awk \'BEGIN {print "["} {print} END {print "]"}\'',
    ];

    const command = commandParts.join(' ');
    this.log('cmd: ', command, '\n');
    const output = execSync(command, { encoding: 'utf-8' });

    this.log('output: ', output);

    const formattedLogs = JSON.parse(output);
    const contentArr = formattedLogs.map((item, index) => {
      const msg = item.message;
      const content = msg.split(`${startWith}`)[1].trim();
      return { index: index + 1, content, md: `- ${item.author} (${item.date}): ${content}` };
    });

    if (saveAs || this.opts.file) {
      const savePath = `${process.cwd()}/${saveAs}` || this.opts.file;
      const content = contentArr.map((item) => item.md).join('\n');
      const saveContent = `---\ntitle: Git Commit Analysis\ndate: ${dayjs().format('YYYY-MM-DD HH:mm:ss')}\n---\n\n${content}`;
      fs.writeFileSync(savePath, saveContent, { encoding: 'utf-8' });
    } else {
      console.log(contentArr);
    }
  }
}

new CliApp().run();
