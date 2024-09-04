#!/usr/bin/env node

import { Command, Option } from 'commander';
import { createRequire } from 'module';
import fs from 'fs';
import { execSync } from 'child_process';
import dayjs from 'dayjs';

const __dirname = new URL('../', import.meta.url).pathname;
const require = createRequire(__dirname);
const pkg = require('./package.json');
const program = new Command();

program.version(pkg.version);
program
  .addOption(new Option('-v, --verbose', 'show verbose log'))
  .addOption(new Option('-i, --init', 'init gmaConfig to package.json'))
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

  log(...args) {
    const { verbose } = this.opts;
    if (verbose) console.log('📗', ...args);
  }

  init() {
    // set gmaConfig to package.json
    const gmaConfig = JSON.stringify({
      dateStart: '2021-01-01',
      dateEnd: '2021-12-31',
      startWith: 'feat:',
      saveAs: 'git-commit-analysis.md',
    });
    //use npm pkg set gmaConfig to set gmaConfig to package.json

    execSync(`npm pkg set  --json gmaConfig='${gmaConfig}'`, { encoding: 'utf-8' });
    // execSync('npm pkg set gmaConfig=' + JSON.stringify(gmaConfig), { encoding: 'utf-8' });
    // fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2), { encoding: 'utf-8' });
  }

  run() {
    if (!pkg.gmaConfig) {
      console.log('Please run `gma init` first.');
      return;
    }

    if (this.opts.init) {
      this.init();
      return;
    }

    const { dateStart, dateEnd, startWith, saveAs } = pkg.gmaConfig;

    // 用数组维护命令的各个部分
    const commandParts = [
      'git log',
      `--since="${dateStart}"`,
      `--until="${dateEnd}"`,
      '--pretty=format:\'{"author": "%an", "message": "%s", "date": "%ad"},\'',
      "--date=format:'%Y-%m-%d %H:%M:%S'",
      `| grep '^.*${startWith}'`,
      "| sed '$ s/,$//'",
      '| awk \'BEGIN {print "["} {print} END {print "]"}\'',
    ];

    // 将命令数组组合成字符串
    const command = commandParts.join(' ');

    // 执行命令并获取输出
    const output = execSync(command, { encoding: 'utf-8' });

    // 将输出解析为 JSON 对象数组
    const formattedLogs = JSON.parse(output);

    const contentArr = formattedLogs.map((item, index) => {
      const msg = item.message;
      const content = msg.split(`${startWith}`)[1].trim();
      return { index: index + 1, content, md: `- ${item.author} (${item.date}): ${content}` };
    });

    // 保存到文件
    if (saveAs) {
      const savePath = `${__dirname}/${saveAs}`;
      const content = contentArr.map((item) => item.md).join('\n');
      const saveContent = `---\ntitle: Git Commit Analysis\ndate: ${dayjs().format('YYYY-MM-DD HH:mm:ss')}\n---\n\n${content}`;
      require('fs').writeFileSync(savePath, saveContent, { encoding: 'utf-8' });
    } else {
      console.log(contentArr);
    }
  }
}

new CliApp().run();
