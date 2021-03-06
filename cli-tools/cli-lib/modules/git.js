const spawn = require('cross-spawn');
const chalk = require('chalk');
const rimraf = require('rimraf');
const path = require('path');
const fs = require('fs');

const NAME_REGEX = /\/(?!.*\/)(.+)\.git/i;
/**
 *
 *
 * @class Git
 */
class Git {
  /**
   *
   *
   * @static
   * @param {Array} [params=[]]
   * @param {Object} [options={}]
   * @return {Promise}
   * @memberof Git
   */
  static __run(params = [], options = {}) {
    return new Promise((resolve, reject) => {
      process.stdout.write(chalk.cyan(`running... git ${params.join(' ')}\n`) + '\n');
      let res = '';
      const git = spawn('git', params, Object.assign({stdio: 'inherit'}, options));

      if (git.stdout !== null) {
        git.stdout.on('data', (data) => {
          res += data;
        });
      }

      git.on('close', (code) => {
        if (code === 0) {
          resolve(res);
        } else {
          reject({
            code,
            command: 'git',
            subCommand: params[0]
          });
        }
      });
    });
  }

  static getNameFromUrl(url) {
    const matches = NAME_REGEX.exec(url);

    if (matches === null) {
      throw new Error(`${url} is not a valid git url.`);
    }

    return matches[1];
  }

  /**
   *
   * @static
   * @param {String} dir
   * @return {String}
   * @memberof Git
   */
  static findGitDir(dir) {
    let tempDir = '';
    while (tempDir !== dir) {
      const gitDir = path.join(dir, '.git');
      try {
        const stats = fs.statSync(gitDir);
        if (stats.isDirectory()) {
          return dir;
        }
        const content = fs.readFileSync(dir);
        const path = content.exec(/gitdir:\s*(.*)/)[1];
        return path.resolve(path.join(dir, path));
      } catch (e) {}

      tempDir = dir;
      dir = path.dirname(dir);
    }

    throw new Error('not a git directory');
  }

  /**
   *
   *
   * @see {@link https://git-scm.com/docs/git-ls-remote.html|git-ls-remote}
   * @static
   * @param {String} repository
   * @param {boolean} [heads=false]
   * @param {boolean} [tags=false]
   * @param {boolean} [refsFlag=false]
   * @param {string} [uploadPack='']
   * @param {boolean} [quiet=false]
   * @param {boolean} [exitCode=false]
   * @param {boolean} [getUrl=false]
   * @param {string} [sort='']
   * @param {boolean} [symref=false]
   * @param {Array} [refs=[]]
   * @param {Object} [options={}]
   * @return {Promise}
   * @memberof Git
   */
  static lsRemote(repository, heads = false, tags = false, refsFlag = false, uploadPack = '',
  quiet = false, exitCode = false, getUrl = false, sort = '', symref = false,
  refs = [], options = {}) {
    const params = ['ls-remote'];
    if (heads) { params.push('--heads'); }
    if (tags) { params.push('--tags'); }
    if (refsFlag) { params.push('--refs'); }
    if (uploadPack && uploadPack !== '') { params.push(`--upload-pack=${uploadPack}`); }
    if (quiet) { params.push('--quiet'); }
    if (exitCode) { params.push('--exitCode'); }
    if (getUrl) { params.push('--get-url'); }
    if (sort && sort !== '') { params.push(`--sort=${sort}`); }
    if (symref) { params.push('--symref'); }
    params.push(repository);
    if (refs && refs.length) { params.push(...refs); }

    return Git.__run(params, options);
  }

  /**
   *
   * @static
   * @param {String} data
   * @param {String} ref
   * @return {Array}
   * @memberof Git
   */
  static filterRef(data, ref) {
    const reg = new RegExp(ref + '$');
    return data.split('\n').reduce((acc, item) => {
      if (reg.test(item)) {
        acc.push(item.split('\t'));
      }
      return acc;
    }, []);
  }


  /**
   *
   *
   * @static
   * @param {String} submodulePath
   * @param {String} url
   * @param {Object} [options={}]
   * @return {Promise}
   * @memberof Git
   */
  static addSubmodule(submodulePath, url, options = {}) {
    return Git.__run(['submodule', 'add', '--', url, submodulePath], {options});
  }


  /**
   *
   *
   * @static
   * @param {String} submodulePath
   * @param {Boolean} force
   * @param {Array} [options={}]
   * @return {Promise}
   * @memberof Git
   */
  static submoduleDeinit(submodulePath, force = false, options = {}) {
    const params = ['submodule', 'deinit'];

    if (force) { params.push('-f'); }
    params.push('--');
    params.push(submodulePath);
    return Git.__run(params, options);
  }


  /**
   *
   * @static
   * @param {*} submodulePath
   * @param {*} [options={}]
   * @memberof Git
   */
  static async removeSubmodule(submodulePath, options = {}) {
    const fullPath = path.resolve(submodulePath);
    const gitDir = Git.findGitDir(fullPath);
    const relativePath = path.relative(gitDir, fullPath);
    await Git.submoduleDeinit(submodulePath, true, options);
    await Git.rm([submodulePath], false, true);
    await new Promise((resolve, reject) => {
      const rmPath = path.join(gitDir, '.git', 'modules', relativePath);
      process.stdout.write(chalk.cyan(`running... rm -r ${rmPath}\n`) + '\n');
      rimraf(rmPath, (err) => {
        if (!err) {
          resolve();
        } else {
          reject(err);
        }
      });
    });
  }


  /**
   *
   * @static
   * @param {*} paths
   * @param {boolean} [recursive=false]
   * @param {boolean} [force=false]
   * @param {boolean} [cached=false]
   * @param {boolean} [ignoreUnmatch=false]
   * @param {boolean} [dryrun=false]
   * @param {boolean} [quiet=false]
   * @param {*} [options={}]
   * @return {Promise}
   * @memberof Git
   */
  static rm(paths, recursive = false, force = false, cached = false, ignoreUnmatch = false,
  dryrun = false, quiet = false, options = {}) {
    const params = ['rm'];
    if (force) { params.push('-f'); }
    if (dryrun) { params.push('-n'); }
    if (recursive) { params.push('-r'); }
    if (cached) { params.push('--cached'); }
    if (ignoreUnmatch) { params.push('--ignore-unmatch'); }
    if (quiet) { params.push('--quiet'); }
    params.push('--');
    params.push(...paths);

    return Git.__run(params, options);
  }

  static mv(source, destination, force = false, skip = false, dry = false, verbose = false, options = {}) {
    const params = ['mv'];
    if (force) { params.push('-f'); }
    if (skip) params.push('-k');
    if (dry) params.push('-n');
    if (verbose) params.push('-v');

    params.push(source);
    params.push(destination);

    return Git.__run(params, options);
  }

  /**
   *
   *
   * @static
   * @param {String} [ref='master']
   * @param {Object} [options={}]
   * @return {Promise}
   * @memberof Git
   */
  static checkout(ref = 'master', options = {}) {
    return Git.__run(['checkout', ref], options);
  }

  /**
   *
   *
   * @static
   * @param {*} repo
   * @param {string} [directory='']
   * @param {*} [options={}]
   * @return {Promise}
   * @memberof Git
   */
  static clone(repo, directory = '', branch, options = {}) {
    const params = ['clone'];
    if (branch) {
      params.push('--branch', branch);
    }
    params.push(repo);
    if (directory !== '') {
      params.push(directory);
    }
    return Git.__run(params, options);
  }

  /**
   *
   *
   * @static
   * @param {boolean} [short=false]
   * @param {boolean} [branch=false]
   * @param {boolean} [showStash=false]
   * @param {boolean} [porcelain=false]
   * @param {boolean} [long=false]
   * @param {boolean} [verbose=false]
   * @param {*} [options={}]
   * @return {Promise}
   */
  static status(short = false, branch = false, showStash = false, porcelain = false, long = false,
  verbose = false, options = {}) {
    const params = ['status'];
    if (short) params.push('-s');
    if (branch) params.push('-b');
    if (showStash) params.push('--show-stash');
    if (porcelain) params.push('--porcelain');
    if (long) params.push('--long');
    if (verbose) params.push('-v');

    return Git.__run(params, options);
  }


  /**
   *
   *
   * @static
   * @param {string} [format='tar']
   * @param {boolean} [verbose=false]
   * @param {string} [prefix='']
   * @param {string} [output='']
   * @param {string} [remote='']
   * @param {String} treeish
   * @param {Array} paths
   * @param {*} [options={}]
   * @return {Promise}
   */
  static archive(format = 'tar', verbose = false, prefix = '', output = '', remote = '', treeish, paths = [], options = {}) {
    const params = [
      'archive',
      `--format=${format}`
    ];

    if (verbose) params.push('-v');
    if (prefix !== '') params.push(`--prefix=${prefix}`);
    if (remote !== '') params.push(`--remote=${remote}`);
    if (typeof treeish !== 'undefined') params.push(treeish);
    if (paths.length > 0) params.push(...paths);

    return Git.__run(params, options);
  }
}

module.exports.Git = Git;
