#! /usr/bin/env node

const randomBytes = require('randombytes')
const fs = require('fs')
const yargs = require('yargs/yargs')
const cm = require('./common')
const { privateToAddress } = require('ethereumjs-util')
const cluster = require('cluster')
const process = require('process')
const { time } = require('console')

const parseArgv = (args) => {
    return yargs(args)
        .usage('Create billion ERC20 addresses, check if any of them can proceduce vanity ERC20 contract addresses at given nonce or get you thousands vanity ERC20 addresses, depends on what you want')
        .example(
            "$0 --contract --pattern 88888 99999 --nonce 2 --noPrivateKey",
            "Find wallets can proceduce vanity ERC20 contract addr starts or ends with 88888 or 99999 at nonce 2"
        )
        .example(
            "$0 --address --pattern 88888 99999 --noPrivateKey",
            "Find wallets with addr starts or ends with 88888 or 99999"
        )
        .example(
            "$0 -c -p c0ffee b00b5 -n 6 -s",
            "Find wallets can proceduce vanity ERC20 contract addr starts or ends with c0ffee or b00b5 at nonce 6"
        )
        .example(
            "$0 -a -p c0ffee b00b5 -s",
            "Find wallets with addr starts or ends with c0ffee or b00b5"
        )
        .option('contract', {
            alias: 'c',
            describe: 'Generate contract mode',
            requiresArg: false,
        })
        .option('address', {
            alias: 'a',
            describe: 'Generate address mode',
            requiresArg: false,
        })
        .option('pattern', {
            alias: 'p',
            describe: 'are patterns to match, accept single or multiple values',
            requiresArg: true,
            string: true,
            array: true,
        })
        .option('nonce', {
            alias: 'n',
            describe: '(for contract mode only) it is nonce you expect. Minimum value is 1 because you must test your wallet by making at least one payout transaction before using to prevent unexpected loss. Can set to 0 if flag `--allowNonce0` also provided',
            requiresArg: true,
            number: true,
        })
        .option('allowNonce0', {
            alias: 'z',
            describe: '(for contract mode only) Allow value of flag `--nonce` can be set to 0',
            requiresArg: false,
        })
        .option('noPrivateKey', {
            alias: 's',
            describe: 'do not write private key to log file (output-?.txt files)',
            requiresArg: false,
        })
        .option('cpu', {
            alias: 'x',
            describe: 'to specify number of children processes (maximum equals to number of CPUs), default = number of CPUs - 1. Machines with above 10 cores, to achieve max performance, should launch multiple processes with single core each (-x=1)',
            requiresArg: true,
            number: true,
        })
        .option('exit', {
            alias: 'e',
            describe: 'Exit after X minutes',
            requiresArg: false,
            number: true,
        })
        .option('debug', {
            alias: 'd',
            describe: `(for debugging purpose only) allow default encryption password 123456 from file ${cm.passwordFileName}`,
        })
        .version()
        .option('donate', {
            describe: 'My ERC wallet 0xfcA11210CC837F37b354d4A3b716316375499999 aka taoist-world.eth (via BSC to lower gas fee)'
        })
        .help('help')
        .argv
}

const printDonate = () => {
    if (cluster.isPrimary) {
        console.log('========================')
        console.log('If you like my work, donate me a coffee too 0xfcA11210CC837F37b354d4A3b716316375499999 (ENS: taoist-world.eth)')
        console.log(' (should send via BSC to lower gas fee)')
        console.log('I appreciate your love for my wasted working hours')
        console.log('========================')
    }
}

/**
 * Returns vanity score, if zero then not match
 */
const generateNewWalletAndGetVanityScore = () => {
    const randbytes = randomBytes(32)
    const addressAsBytes = privateToAddress(randbytes)
    if (cfg.contractMode) {
        const contractAddress = cm.fromAddressToContractAddressAtGivenNonce(addressAsBytes, cfg.nonce).toString('hex')

        for (const idx in cfg.patterns) {
            const startsWith = contractAddress.startsWith(cfg.patterns[idx].p)
            const endsWith = contractAddress.endsWith(cfg.patterns[idx].p)
            if (startsWith || endsWith) {
                const address = addressAsBytes.toString('hex')

                let vanityScore = cm.rateVanityScoreOfAddress(contractAddress, startsWith, endsWith, cfg.patterns[idx].s, address, cfg.patterns[idx].p)
                const sVanityScore = vanityScore < 10 ? `0${vanityScore}` : `${vanityScore}`

                if (vanityScore >= cm.minimumWow) {
                    console.log(`Wow, vanity score ${vanityScore}`)
                    cm.appendFile(`${cfg.baseDir}${cfg.defaultWowVSFilePrefix}-${sVanityScore}.txt`, `\nVanityScore=${sVanityScore}\tContractAddr=0x${contractAddress}\tWalletAddr=0x${address}`)
                }

                const priv = randbytes.toString('hex')
                console.log(`VS=${sVanityScore}.....C=${contractAddress} <= ${address}`)
                if (cfg.doNotSavePrivateKeyToLog) {
                    cm.appendFile(cfg.logFile, `VanityScore=${sVanityScore}\tNonce=${cfg.nonce}\tContractAddr=0x${contractAddress}\tWalletAddr=0x${address}\tPRIVATE_KEY_IS_NOT_SAVED_INTO_LOG`)
                } else {
                    cm.appendFile(cfg.logFile, `VanityScore=${sVanityScore}\tNonce=${cfg.nonce}\tContractAddr=0x${contractAddress}\tWalletAddr=0x${address}\tPrivateKey=${priv}`)
                }

                const jsonWalletContent = cm.fromPrivateKeyToV3KeyStore(priv, cfg.password)
                cm.appendFile(`${cfg.defaultWalletDir}/vscore=${sVanityScore}_contract=${contractAddress}_wallet=${address}_nonce=${cfg.nonce}.json`, JSON.stringify(jsonWalletContent))

                return vanityScore
            }
        }
    } else {
        const address = addressAsBytes.toString('hex')

        for (const idx in cfg.patterns) {
            const startsWith = address.startsWith(cfg.patterns[idx].p)
            const endsWith = address.endsWith(cfg.patterns[idx].p)
            if (startsWith || endsWith) {
                let vanityScore = cm.rateVanityScoreOfAddress(address, startsWith, endsWith, cfg.patterns[idx].s)
                const sVanityScore = vanityScore < 10 ? `0${vanityScore}` : `${vanityScore}`

                if (vanityScore >= cm.minimumWow) {
                    console.log(`Wow, vanity score ${vanityScore}`)
                    cm.appendFile(`${cfg.baseDir}${cfg.defaultWowVSFilePrefix}-${sVanityScore}.txt`, `\nVanityScore=${sVanityScore}\tWalletAddr=0x${address}`)
                }

                const priv = randbytes.toString('hex')
                console.log(`VS=${sVanityScore}.....A=0x${address}`)
                if (cfg.doNotSavePrivateKeyToLog) {
                    cm.appendFile(cfg.logFile, `VanityScore=${sVanityScore}\tWalletAddr=0x${address}\tPRIVATE_KEY_IS_NOT_SAVED_INTO_LOG`)
                } else {
                    cm.appendFile(cfg.logFile, `VanityScore=${sVanityScore}\tWalletAddr=0x${address}\tPrivateKey=${priv}`)
                }

                const jsonWalletContent = cm.fromPrivateKeyToV3KeyStore(priv, cfg.password)
                cm.appendFile(`${cfg.defaultWalletDir}/vscore=${sVanityScore}_wallet=${address}.json`, JSON.stringify(jsonWalletContent))

                return vanityScore
            }
        }
    }

    return 0
}

const cfg = {

}

const main = function() {
    const argv = parseArgv(process.argv.slice(2))

    const baseDir = 'vanity-eth-plus/'
    const baseWalletsDir = `${baseDir}wallets/`
    const addrWalletsDir = `${baseWalletsDir}addr/`
    const contractWalletsDir = `${baseWalletsDir}contract/`

    try {
        // create required directories
        cm.createDir(baseDir)
        cm.createDir(baseWalletsDir)
        cm.createDir(addrWalletsDir)
        cm.createDir(contractWalletsDir)
    } catch (e) {
        console.error(e)
        console.error('ERR: Failed to creates required directories!!!')
        console.error(`\t${baseDir}`)
        console.error(`\t${baseWalletsDir}`)
        console.error(`\t${addrWalletsDir}`)
        console.error(`\t${contractWalletsDir}`)
        console.error(' Is it permission issue?')
        return
    }
    
    const contractMode = argv.contract !== undefined
    const addressMode = argv.address !== undefined
    
    if (!contractMode && !addressMode) {
        console.error('ERR: You must specify either flag `--contract` or `--address`')
        return
    } else if (contractMode && addressMode) {
        console.error('ERR: You can only specify one of too flag `--contract` or `--address`')
        return
    }
    
    const defaultWalletDir = contractMode ? contractWalletsDir : addrWalletsDir
    const defaultLogFilePrefix = contractMode ? 'output-contract' : 'output-addr'
    const defaultWowVSFilePrefix = contractMode ? 'vscore-contract' : 'vscore-addr'

    const isDebug = argv.debug === true

    const nonce = contractMode ? cm.parseNonce(argv) : undefined
    if (contractMode) {
        if (nonce === undefined) {
            return
        }

        if (argv.allowNonce0 === true) {
            if (nonce < 0) {
                console.error('ERR: Value of flag --nonce must be >= 0')
                return
            }
        } else {
            if (nonce < 1) {
                console.error('ERR: Value of flag --nonce must be >= 1')
                console.error(' Minimum nonce is 1 because you must test every generated wallets before use (so nonce 0 will be used for the very first transaction)')
                return
            }
        }

        if (cluster.isPrimary && nonce > 10) {
            console.log(`WARNING: Selected nonce ${nonce} is too high. Nonce is number of transaction an address have sent before. This app generates new addresses so if nonce is too high which means you have to make a lot transactions to fill the gap`)
        }
    }

    const patterns = cm.parsePatterns(argv)

    if (!patterns) {
        return
    }

    if (contractMode) {
        if (cluster.isPrimary) {
            if (patterns.length == 1) {
                console.log(`Searching for ERC20 addresses which can create contract with prefix or suffix '${patterns[0]}' at nonce ${nonce} (0x${nonce.toString(16)})`)
            } else {
                console.log('Searching for ERC20 addresses which can create contract with prefix or suffix in list')
                console.log(`[${patterns.join(', ')}]`)
                console.log(`at nonce ${nonce} (0x${nonce.toString(16)})`)
            }
        }
    } else {
        if (cluster.isPrimary) {
            if (patterns.length == 1) {
                console.log(`Searching for ERC20 addresses with prefix or suffix '${patterns[0]}'`)
            } else {
                console.log('Searching for ERC20 addresses with prefix or suffix in list')
                console.log(`[${patterns.join(', ')}]`)
            }
        }
    }

    const inputThreadsInfo = cluster.isPrimary ? cm.parseChildrenProcessesCount(argv) : undefined
    const numberOfChildren = inputThreadsInfo ? inputThreadsInfo.count : undefined
    const isMaximumCpuUsed = inputThreadsInfo ? inputThreadsInfo.max: undefined
    const isSingleCpuMode = inputThreadsInfo ? inputThreadsInfo.single : undefined
    if (cluster.isPrimary) {
        if (!numberOfChildren) {
            return
        }
    }

    const password = cm.readPassword(isDebug)
    if (!password) {
        return
    }

    const doNotSavePrivateKeyToLog = argv.noPrivateKey === true

    if (cluster.isPrimary) {
        console.log(`Generated ERC20 addresses will be written into file '${baseDir}${defaultLogFilePrefix}-?.txt' and json wallet files will be written into '${defaultWalletDir}' directory`)
    }

    cm.initVanityScoreTable()
    
    if (cluster.isPrimary) {
        if (doNotSavePrivateKeyToLog) {
            console.log('You have selected to not to save raw private key into log file')
        } else {
            console.log('WARNING: This app will save private key of generated addresses into log file, to disable this feature, use --noPrivateKey option')
        }
        console.log('WARNING: You HAVE TO test every generated wallets before using them to prevent un-expected loss. Firstly test import using json wallet file, secondly test transfer funds on Test Nets')
    }

    cfg.contractMode = contractMode
    cfg.nonce = nonce
    cfg.patterns = patterns
    cfg.password = password
    // cfg.logFile = 
    cfg.doNotSavePrivateKeyToLog = doNotSavePrivateKeyToLog
    cfg.baseDir = baseDir
    cfg.defaultWowVSFilePrefix = defaultWowVSFilePrefix
    cfg.defaultWalletDir = defaultWalletDir

    let highestVanityScore = 0

    const startMs = cm.getNowMs()

    const inputExit = cm.parseExit(argv)
    const exitAtMs = inputExit === undefined ? undefined : startMs + inputExit * 60 * 1000
    if (exitAtMs && cluster.isPrimary) {
        console.log(`Application will exits after ${inputExit} minutes`)
    }

    if (cluster.isPrimary && isSingleCpuMode) {
        let lastReport = startMs // first report is 5s after started
        const pid = privateToAddress(randomBytes(32)).toString('hex').substring(0, 6)
        const reportInterval = 20000 // 20s
        const logFile = `${baseDir}${defaultLogFilePrefix}-${pid}.txt`
        let generated = 0 // total number of addresses generated by this process
        let found = 0 // total number of addresses generated by this process and match requirement
        let reportCounter = 0
        cm.appendFile(logFile, 'App starts') // Test log to make sure process has permission to write file

        console.log(`Single process ${pid} has started`)

        cm.injectBaseVanityScore(patterns)

        console.log(`NOTICE: It's safe to remove the password file at this point if you are running single process`)
        if (process.platform !== "win32") {
            console.log(` TIPS: Recommended way to remove a file with sensitive data is running command: rm -P <file_name>`)
            console.log(`  since it will rewrite content of file with some pseudo content before permanent delete it`)
        }

        cfg.logFile = logFile

        for (;;) {
            const score = generateNewWalletAndGetVanityScore()
            generated++

            if (score > 0) {
                found++

                if (score > highestVanityScore) {
                    highestVanityScore = score
                }
            }

            if (++reportCounter > 250000) {
                reportCounter = 0
                const nowMs = cm.getNowMs()
                if (nowMs - lastReport < reportInterval) {
                    continue
                }
                lastReport = nowMs
                const timePassed = Math.floor((nowMs - startMs) / 1000)

                console.log(`${timePassed} seconds passed, generated ${generated} addresses, avg ${(found / timePassed).toFixed(3)} found addr/s from ${Math.floor(generated / timePassed)} created addr/s. Highest vanity score = ${highestVanityScore}`)

                if (exitAtMs && exitAtMs < nowMs) {
                    console.log('Application is exitting due to flag `--exit`!')
                    process.exit(0)
                }
            }
        }
    } else if (cluster.isPrimary) {
        const cache = []
        console.log(`Launching ${numberOfChildren} children processes`)

        for (let i = 0; i < numberOfChildren; i++) {
            const cacheData = {
                generated: 0,
                found: 0,
            }
            cache.push(cacheData)
            const proc = cluster.fork({
                pidChild: i + 1,
                childrenCount: numberOfChildren,
                report: isMaximumCpuUsed,
            })
            if (!isMaximumCpuUsed) {
                proc.on('message', function(msg) {
                    if (msg.pidChild) {
                        cacheData.generated = msg.generated
                        cacheData.found = msg.found
                        highestVanityScore = Math.max(highestVanityScore, msg.highestVanityScore)
                    }
                })
            }
        }

        if (isMaximumCpuUsed) {
            console.log('Due to all CPUs are used for computing so each child process will report by it\'s self')
        } else {
            const interval = setInterval(function() {
                const nowMs = cm.getNowMs()
                const timePassed = Math.floor((nowMs - startMs) / 1000)

                let sumGenerated = 0
                let sumFound = 0
                for (const idx in cache) {
                    sumGenerated += cache[idx].generated
                    sumFound += cache[idx].found
                }
                console.log(`${timePassed} seconds passed, generated ${sumGenerated} addresses, avg ${(sumFound / timePassed).toFixed(3)} found addr/s from ${Math.floor(sumGenerated / timePassed)} created addr/s. Highest vanity score = ${highestVanityScore}`)

                if (exitAtMs && exitAtMs < nowMs) {
                    console.log('Application is exitting due to flag `--exit`!')
                    clearInterval(interval)
                    process.exit(0)
                }
            }, 20000)
        }

        printDonate()

    } else {
        let lastReportChild = startMs // first report is 5s after started
        const childEnv = process.env
        const pidChild = childEnv.pidChild
        const selfReport = childEnv.report === true || childEnv.report == 'true'
        const reportIntervalChild = selfReport ? 20000: 10000
        const logFileChild = `${baseDir}${defaultLogFilePrefix}-${pidChild}.txt`
        let generatedOnChild = 0 // total number of addresses generated by this process
        let foundOnChild = 0 // total number of addresses generated by this process and match requirement
        let reportCounterOnChild = 0
        cm.appendFile(logFileChild, 'App starts') // Test log to make sure process has permission to write file

        console.log(`Child process ${pidChild} has started`)

        cm.injectBaseVanityScore(patterns)

        if (childEnv.childrenCount == pidChild) {
            console.log(`NOTICE: It's safe to remove the password file at this point`)
            if (process.platform !== "win32") {
                console.log(` TIPS: Recommended way to remove a file with sensitive data is running command: rm -P <file_name>`)
                console.log(`  since it will rewrite content of file with some pseudo content before permanent delete it`)
            }
        }

        cfg.logFile = logFileChild

        for (;;) {
            const score = generateNewWalletAndGetVanityScore()
            generatedOnChild++

            if (score > 0) {
                foundOnChild++

                if (score > highestVanityScore) {
                    highestVanityScore = score
                }
            }

            if (++reportCounterOnChild > 250000) {
                reportCounterOnChild = 0
                const nowMs = cm.getNowMs()
                if (nowMs - lastReportChild < reportIntervalChild) {
                    continue
                }
                lastReportChild = nowMs
                const timePassed = Math.floor((nowMs - startMs) / 1000)

                if (selfReport) {
                    console.log(`(Child ${pidChild}) avg ${(foundOnChild / timePassed).toFixed(3)} found addr/s from ${Math.floor(generatedOnChild / timePassed)} created addr/s`)
                } else {
                    process.send({
                        pidChild: pidChild,
                        generated: generatedOnChild,
                        found: foundOnChild,
                        highestVanityScore: highestVanityScore,
                    })
                }

                if (exitAtMs && exitAtMs < nowMs) {
                    console.log('Application is exitting due to flag `--exit`!')
                    process.exit(0)
                }
            }
        }
    }
}

main()