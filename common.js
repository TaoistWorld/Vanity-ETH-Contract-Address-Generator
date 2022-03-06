const fs = require('fs')
const rlp = require('rlp')
const util = require('ethereumjs-util')
const Web3 = require('web3')
const os = require('os')
const cluster = require('cluster')
const web3 = new Web3('https://non-exists-host.non-exists-tld'/* use a non-exists url for safety purpose */)

const minimumLengthToCheckVanityScore = 3
const maximumLengthToCheckVanityScore = 19

const giveBaseVanityScoreToPattern = (pattern) => {
    if (typeof pattern !== 'string')
        throw `Pattern must be string`
    const patternLen = pattern.length
    if (patternLen < 3) {
        return 0
    }
    if (patternLen <= 5) {
        return patternLen
    }
    const extraLen = patternLen - 5
    let vscore = 5
    for (let i = 0; i < extraLen; i++) {
        vscore += (i + 2)
    }
    return vscore
}

const injectBaseVanityScore = (arr) => {
    for (const idx in arr) {
        const pattern = arr[idx]
        arr[idx] = {
            p: pattern,
            s: giveBaseVanityScoreToPattern(pattern),
        }
    }
}

/*
 * Generate something like 999999 based on selected character and length
 * Eg: 999999 is result of generateContinousText(9, 6)
 */
const generateContinousText = (char, length) => {
    let result = ''
    for (let i = 0; i < length; i++) {
        result = `${result}${char}`
    }
    return result
}

const continous = []
const initVanityScoreTable = function() {
    for (let c = 0; c <= 9; c++) {
        const cL = []
        for (let i = 0; i < minimumLengthToCheckVanityScore; i++) {
            cL.push(i)
        }
        for (let l = minimumLengthToCheckVanityScore; l <= maximumLengthToCheckVanityScore; l++) {
            const pattern = generateContinousText(c, l)
            cL.push({
                p: pattern,
                s: giveBaseVanityScoreToPattern(pattern),
            })
        }
        continous.push(cL)
    }

    const alphabet = ['a', 'b', 'c', 'd', 'e', 'f']
    for (const idx in alphabet) {
        const cL = []
        for (let i = 0; i < minimumLengthToCheckVanityScore; i++) {
            cL.push(i)
        }
        for (let l = minimumLengthToCheckVanityScore; l <= maximumLengthToCheckVanityScore; l++) {
            const pattern = generateContinousText(alphabet[idx], l)
            cL.push({
                p: pattern,
                s: giveBaseVanityScoreToPattern(pattern),
            })
        }
        continous.push(cL)
    }
}

const _rateAddress = (address, prefix) => {
    let highestVanityScore = 0
    for (let c = 15 /* 9 -> 0 */ /* a -> f */; c >= 0; c--) {
        if (prefix) {
            if (!address.startsWith(continous[c][minimumLengthToCheckVanityScore].p)) {
                continue
            }
        } else {
            if (!address.endsWith(continous[c][minimumLengthToCheckVanityScore].p)) {
                continue
            }
        }
        highestVanityScore = continous[c][minimumLengthToCheckVanityScore].s
        for (let l = minimumLengthToCheckVanityScore + 1; l <= maximumLengthToCheckVanityScore; l++) {
            if (prefix) {
                if (address.startsWith(continous[c][l].p)) {
                    highestVanityScore = continous[c][l].s
                } else {
                    return highestVanityScore
                }
            } else {
                if (address.endsWith(continous[c][l].p)) {
                    highestVanityScore = continous[c][l].s
                } else {
                    return highestVanityScore
                }
            }
        }
    }
    return highestVanityScore
}

/*
 * Give vanity score for an address
 */
const rateAddress = (address) => {
    return _rateAddress(address, true) + _rateAddress(address, false)
}

const getNowMs = () => {
    return new Date().getTime()
}

const appendFile = (logFile, logContent) => {
    try {
        fs.writeFileSync(logFile, '\n' + logContent, { flag: 'a+' })
        //file written successfully
    } catch (err) {
        console.error(err)
        console.error(`ERR: Failed to append content: '${logContent}'`)
        console.error(` into file '${logFile}'`)
    }
}

const passwordFileName = 'vanitye-encryption-password.txt'

const readPassword = (isDebug = false) => {
    if (!fs.existsSync(passwordFileName)) {
        try {
            fs.writeFileSync(passwordFileName, '123456', { flag: 'a+' })
        } catch (err) {
            console.error(err)
            console.error(`ERR: Unable to create default ${passwordFileName} file`)
            console.error(`ERR: You may need to check permission, or manually create a file with name ${passwordFileName}, open it with a text editor and write your password you want to encrypt wallet info`)
            return
        }
    }

    const password = fs.readFileSync(passwordFileName, 'utf8').toString().trim()
    if (password === '123456') {
        if (isDebug === true) {
            return password
        }
        console.error(`ERR: You have to open ${passwordFileName} file and replace the default password 123456 with yours strongly secured password. This password will be used to create json wallet files (V3 keystore)`)
        return
    } else {
        const minimumPasswordLength = 6
        if (password.length < minimumPasswordLength) {
            console.error(`ERR: Password is too short, require minimum ${minimumPasswordLength} characters in length`)
            return
        }
        if (cluster.isPrimary) {
            console.log(`WARNING: remember to wipe content of ${passwordFileName} file after you done. It's dangerous to leave your secure password there`)
        }
        return password
    }
}

const minimumPatternStringLength = 5

const parsePatterns = (argv) => {
    const inputPatterns = argv.pattern

    if (!inputPatterns) {
        console.error('ERR: No pattern was provided, use flag --pattern to specify')
        return
    }

    if (typeof inputPatterns == 'boolean') {
        console.error('ERR: Wrong usage of flag --pattern, it requires parameter')
        return
    }

    const patterns = Array.isArray(inputPatterns) ? inputPatterns : [`${inputPatterns}`]

    if (patterns.length < 1) {
        console.error('ERR: No pattern was provided, use flag --pattern to specify')
        return
    }

    if (cluster.isPrimary) {
        const re = /^[0-9aA-fF]+$/
        for (const idx in patterns) {
            const pattern = patterns[idx] = `${patterns[idx]}`.toLowerCase()
            if (pattern.length < minimumPatternStringLength) {
                console.error(`ERR: Pattern '${pattern}' is too short, minimum length is ${minimumPatternStringLength}`)
                return
            }
            if (!re.test(pattern)) {
                console.error(`ERR: Invalid pattern '${pattern}', only accept combination of 0-9 a-f (hex)`)
                return
            }
            console.log(`Pattern '${pattern}' difficulty = ${Math.pow(16, pattern.length)}`)
        }
    } else {
        for (const idx in patterns) {
            patterns[idx] = `${patterns[idx]}`.toLowerCase()
        }
    }

    patterns.sort(function(a, b) {
        return b.length - a.length
    })

    return patterns
}

const parseNonce = (argv) => {
    const nonce = argv.nonce

    if (nonce === undefined) {
        console.error('ERR: Missing flag --nonce')
        return
    }

    if (typeof nonce != 'number') {
        console.error(`ERR: Flag --nonce must be a number (${typeof nonce} found)`)
        return
    }

    if (Math.floor(nonce) != nonce) {
        console.error('ERR: Flag --nonce must be an integer')
        console.error('ERR: Minimum nonce is 1 because you must test every generated wallets before use (so nonce 0 will be used for the very first transaction)')
        return
    }

    return nonce
}

const numCPUs = os.cpus().length
const suggestedProcessesCount = Math.max(1, numCPUs - 1)

const parseChildrenProcessesCount = (argv) => {
    const count = argv.cpu

    if (count === undefined) {
        return {
            count: suggestedProcessesCount,
            max: false,
            single: suggestedProcessesCount === 1,
        }
    }

    if (count < 1 || count > numCPUs) {
        console.error(`ERR: Flag --threads must be a number between 1 and ${numCPUs}`)
        return
    }

    if (count > suggestedProcessesCount) {
        console.log(`NOTICE: It is recommended to use less than ${numCPUs} children processes on your machine to prevent machine freeze issue`)
    }

    return {
        count: count,
        max: count >= numCPUs,
        single: count === 1,
    }
}

const parseExit = (argv) => {
    const exit = argv.exit
    if (!exit) {
        return
    }
    if (exit < 0) {
        console.error(`ERR: Value of flag --exit can not be negative`)
        return
    }
    if (exit == 0) {
        return
    }
    return exit
}

const minimumWow = minimumPatternStringLength * 2 + 2
const rateVanityScoreOfAddress = (address, startsWith, endsWith, vscore, extraAddress, patternMatched) => {
    let vanityScore = (startsWith ? vscore : 0) + (endsWith ? vscore : 0)
    vanityScore += rateAddress(address)

    if (extraAddress) {
        vanityScore += (extraAddress.startsWith(patternMatched) ? vscore : 0) + (extraAddress.endsWith(patternMatched) ? vscore : 0)
        vanityScore += rateAddress(extraAddress)
    }

    return vanityScore
}

const fromPrivateKeyToV3KeyStore = (privateKeyAsHex, password) => {
    return web3.eth.accounts.encrypt(`0x${privateKeyAsHex}`, password)
}

const fromAddressToContractAddressAtGivenNonce = (bufferAddress, nonce) => {
    return util.keccak256(util.arrToBufArr(rlp.encode([bufferAddress, nonce]))).slice(12)
}

const createDir = (dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir)
    }
}

module.exports = {
    giveBaseVanityScoreToPattern: giveBaseVanityScoreToPattern,
    injectBaseVanityScore: injectBaseVanityScore,
    initVanityScoreTable: initVanityScoreTable,
    parsePatterns: parsePatterns,
    parseNonce: parseNonce,
    parseChildrenProcessesCount: parseChildrenProcessesCount,
    parseExit: parseExit,
    rateAddress: rateAddress,
    getNowMs: getNowMs,
    appendFile: appendFile,
    readPassword: readPassword,
    minimumWow: minimumWow,
    passwordFileName: passwordFileName,
    rateVanityScoreOfAddress: rateVanityScoreOfAddress,
    fromPrivateKeyToV3KeyStore: fromPrivateKeyToV3KeyStore,
    fromAddressToContractAddressAtGivenNonce: fromAddressToContractAddressAtGivenNonce,
    createDir: createDir,
}