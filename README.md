# Vanity ETH Contract & Wallet Address Generator
---
#### Create billions ERC20 addresses, find vanity wallet addresses you want or any wallet address can proceduce a [vanity ERC20 contract address](https://ethereum.stackexchange.com/questions/760/how-is-the-address-of-an-ethereum-contract-computed) at given nonce

### What's a vanity address?
A vanity address is an address which part of it is chosen by yourself, making it look less random.

Examples:
> 0xfcA11210CC837F37b354d4A3b716316375499999

> 0xc0ffeeB00B5254729296a45a3885639ac7e18888

##### What different between this project and other projects?
- Calculate vanity score to be a foundation filter for you lower wasting time review all generated addresses
- Automatically save wallets into json wallet files with v3 keystore format
- Search multiple patterns at the same time
- Infinity crawling with multi-core processors supported (10k-25k wallets generated per sec per core on test environment)

### Setup
```sh
$ npm install vanity-eth-plus -g
```

- To craw vanity contracts, run
```sh
$ vanitye --contract --pattern 66666 99999 --nonce 1 --noPrivateKey
```
> Short hand: `vanitye -c -p 66666 99999 -n 1 -s`

- To craw vanity wallet addresses, run
```sh
$ vanitye --address --pattern 66666 99999 --noPrivateKey
```
> Short hand: `vanitye -a -p 66666 99999 -n 1 -s`

Folder `vanity-eth-plus` will be created automatically in your working directory and all output files will be written into this folder

This app will generate json wallet files (v3 keystore) so requires password to encrypt the wallet. You must edit the `vanitye-encryption-password.txt` file and replace the default password _123456_ with your own. Wipe the file after you done with it or this command can help you
```sh
$ rm -P vanitye-encryption-password.txt
```

###### App will automatically launchs children processes for better performance
    number of children processes = number of CPU cores - 1

### Output
1. All output files are created within `vanity-eth-plus` folder in your working directory
2. Log will be written into `vanity-eth-plus/output-?.txt` files (each child process will writes to a separate file), contains private key of generated wallet addresses (you can ignore by provide `--noPrivateKey` when start app)
    > (Contract mode) Content format: VS=`vanity score` + space + N=`given nonce` + space + `contract addr` + space + `wallet addr` + space + `private key (if flag --noPrivateKey missing)`

    > (Address mode) Content format: VS=`vanity score` + space + `wallet addr` + space + `private key (if flag --noPrivateKey missing)`
2. Json wallet files (v3 keystore) files will be saved into `vanity-eth-plus/wallets/` directory with format:
    > (Contract mode) File name: vscore=`VanityScore`_contract=`0xContractAddr`_wallet=`0xWalletAddr`_nonce=`given nounce`.json

    > (Address mode) File name: vscore=`VanityScore`_wallet=`0xWalletAddr`.json

    > Content format: V3 keystore

File name starts with `vscore=X` is natural filter which helps you lower time wasted in filtering nice looking vanity results

### Arguments

1. `--help` to access help

2. `--pattern` (`-p`) is mandatory string values (single or multiple). They are the patterns you want to match. For example if you want to match 3 patterns `33333`, `66666`, `99999` so you would need to start app with following flags:
    ```sh
    $ vanitye --pattern 33333 66666 99999 (+some more flags if needed)
    ```

3. _(vanity contract only)_ `--nonce` (`-n`) is mandatory integer with minimum value is 1, it is the nonce you expect ([read here](https://ethereum.stackexchange.com/questions/760/how-is-the-address-of-an-ethereum-contract-computed)). Minimum value is 1 because you must test your wallet by making at least one payout transaction before using to prevent unexpected loss

4. _(vanity contract only)_ `--allowNonce0` (`-z`) is optional, it let you set value of `--nonce` to be 0

5. `--noPrivateKey` (`-s`) is optional. By default, app will save private key into log file `output-?.txt`. When you use this flag, private key won't be saved in log, only create json wallet file (v3 keystore)

6. `--cpu` (`-x`) is optional. App will launchs some children processes to maximum number of addr can generate per second, by default, it launchs `number of CPU cores - 1` children processes. By specify this flag, you can adjust number of children processes will be launched, value must be in range from minimum is 1 to maximum is number of CPU cores. It is not recommended to max it because your machine could be frozen

7. `--exit` (`-e`) is optional, app will exit after X minutes if flag is provided

Example a command uses all available flags:
```sh
$ vanitye --contract --pattern 99999 88888 --nonce 0 --allowNonce0 --noPrivateKey --cpu 4 --exit 600
```

> Short hand: `vanitye -c -p 99999 88888 -n 0 -z -s -x 4 -e 600`
    
### Vanity score
A feature helps you lower wasting time spent for reviewing all generated addresses

> Formula: `vanity score of matched pattern` + `vanity score of wallet addr` (+ `vanity score of contract addr` if contract mode)

virtual score by length: 1/2 → 0, 3/4/5 → 3/4/5, 6 → 7, 7 → 10, 8 → 14, 9 → 19, 10 → 25, ...

For example when you vanity contract with pattern `c0ffee`
- Contract Addr: 0xc0ffee...0999
- Deploys by wallet addr: 0x5555...adfff

Vanity Score = vscore('c0ffee') + vscore('999') + vscore('5555') + vscore('fff') = 7 + 3 + 4 + 3 = 17

### Performance
On my 8 cores mac, app can generates 140k addr/s (7 children processes) with ~1 addr/s matches my 5 digits given patterns

On a 32 cores machine on GCP, app can generates 310k addr/s (31 children processes)

##### Recommended way to run on machines with above 10 cores
is run multiple single core processes (with flag `--cpu` or `-x` with value `1`) to reduce resources used for children processes's communitcation. For example with 30 cores machine, you can start ~28 processes with same arguments like `vanitye -a -p 99999 -x 1`

### Security
Everything is computed locally within your machine. There is no database, no push code, nothing communicate with internet. Nothing ever leaves your machine.

Vanity-ETH-Contract-Address-Generator cannot and will never store your private key, and if you don't trust it, you have 2 ways to ensure your key remains private:
- After installed via npm or git clone, you can turn off the internet and continue playing, it will work seamlessly
- The code is 100% open source and [available on Github](https://github.com/TaoistWorld/Vanity-ETH-Contract-Address-Generator). You can review it as much as you want before using it

##### Remember to remove your secured password after done (you can delete it after process has started)

```sh
$ rm -P vanitye-encryption-password.txt
```

### Compatibility
All wallets generated with Vanity ETH Contract Address Generator are ERC-20 compatible, which means you can use them for ICO, AirDrop, or just to withdraw your funds from an exchange.

The json wallet (v3 keystore) files are 100% compatible with MetaMask, MyEtherWallet, Mist, geth and so ons

Contract addr generated when use wallet addr to deploy at given nonce will matches expected [since it's predictable](https://ethereum.stackexchange.com/questions/760/how-is-the-address-of-an-ethereum-contract-computed)

`It is recommended to test transfer & deploy contract using testnets` like [Binance Smart Chain testnet](https://testnet.binance.org/faucet-smart) or [Sokol](https://faucet.poa.network/) `before use`

It would be nice if you can send me a coffee to [taoist-world.eth](https://etherscan.io/address/0xfca11210cc837f37b354d4a3b716316375499999) (or via [BSC](https://bscscan.com/address/0xfcA11210CC837F37b354d4A3b716316375499999) to lower gas fee)