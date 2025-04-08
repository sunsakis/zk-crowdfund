Cargo partisia-contract
Compiles Smart Contracts for the Partisia Blockchain for deployment on-chain.

Installation
You can either install from the crate on crates.io, or from source.

From Crates.io
To install run the command

cargo install cargo-partisia-contract
Install from source
Clone the repository and go to the folder. Run the following command

cargo install --path .
Usage
Compiles Smart Contracts for the Partisia Blockchain for deployment on-chain.

Partisia-contract 
Compiles Smart Contracts for the Partisia Blockchain to WASM- and ABI-files for deployment on-chain.

Usage: cargo pbc [OPTIONS] <COMMAND>

Commands:
  build          Compile contracts to WASM and generate ABI files.
  init           Initialize the contract. Retrieves dependencies for build.
  print-version  Print the client and binder version of the contract.
  path-of-wasm   Print the expected WASM file path based on the context of Cargo.toml
  path-of-abi    Print the expected ABI file path based on the context of Cargo.toml
  set-sdk        Update the sdk used for compiling the contracts. 
  transaction    Sign, Send and interact with the Partisia Blockchain.
  account        Create and interact with accounts on the Partisia Blockchain.
  contract       Get information about contracts deployed on the Partisia Blockchain.
  config         Set default values for options used during execution of commands.
  block          View latest or specific blocks
  wallet         Create a wallet that can be used for sending, signing, and interacting with the Partisia Blockchain
  abi            View information about an abi and generate abi code
  help           Print this message or the help of the given subcommand(s)

Options:
      --net <net-name>
          The net is relevant for commands that interact with the blockchain.
          Specify which blockchain to target. To see all named nets, run "cargo pbc config net -l".
          "mainnet"  Target the mainnet
          "testnet"  Target the testnet
          <net-name>  Target a named custom net
          <reader-url>  Target a custom net (with no browser)
          <reader-url>,<browser-url>  Target a custom net with a custom browser.

  -h, --help
          Print help (see a summary with '-h')

  -V, --version
          Print version
build
Compile a smart contract for deployment on Partisia Blockchain.

Compile contracts to WASM and generate ABI files.

Usage: cargo pbc build [OPTIONS] [ADDITIONAL_ARGS]...

Arguments:
  [ADDITIONAL_ARGS]...  Additional arguments that will be passed along to cargo build, 
                        see cargo build --help for details.

Options:
  -r, --release                        Build artifacts in release mode, with optimizations
  -n, --no-abi                         Skip generating .abi file
  -q, --quiet                          No messages printed to stdout
  -w, --no-wasm-strip                  Do not remove custom sections from the WASM-file (will produce a much larger file).
  -z, --no-zk                          Only compile the public part of the contract. Skips compilation of ZK computation.
      --disable-git-fetch-with-cli     Uses cargo's built-in git library to fetch dependencies instead of the git executable
      --workspace                      Build all packages in the workspace
      --manifest-path <MANIFEST_PATH>  Specify path to the Cargo.toml of the contract or workspace
      --coverage                       Compile an instrumented binary for the smart contract. This enables generation of coverage files.
  -p, --package <PACKAGE>              Build only the specified packages
  -h, --help                           Print help
init
Initialize the contract. Retrieves dependencies for build.

Initialize the contract. Retrieves dependencies for build.

Usage: cargo pbc init [OPTIONS]

Options:
      --workspace                      Init all zk contracts in the workspace
      --manifest-path <MANIFEST_PATH>  Specify path to the Cargo.toml of the contract or workspace
  -h, --help                           Print help
print-version
Create a new smart contract project.

Print the client and binder version of the contract.

Usage: cargo pbc print-version [OPTIONS] <WASM contract>

Arguments:
  <WASM contract>  The wasm file to load

Options:
  -b, --bashlike  Print the version as bash variables
  -h, --help      Print help
path-of-abi
Print the expected ABI file path based on the context of Cargo.toml

Print the expected ABI file path based on the context of Cargo.toml

Usage: cargo pbc path-of-abi [OPTIONS]

Options:
  -r, --release                        File is in release folder instead of debug
      --manifest-path <MANIFEST_PATH>  Specify path to the Cargo.toml of the contract or workspace
  -h, --help                           Print help
path-of-wasm
Print the expected WASM file path based on the context of Cargo.toml

Print the expected WASM file path based on the context of Cargo.toml

Usage: cargo pbc path-of-wasm [OPTIONS]

Options:
  -r, --release                        File is in release folder instead of debug
      --manifest-path <MANIFEST_PATH>  Specify path to the Cargo.toml of the contract or workspace
  -h, --help                           Print help
set-sdk
Update the sdk used for compiling the contracts.

Update the sdk used for compiling the contracts. 

Usage: cargo pbc set-sdk [OPTIONS] <sdk>

Arguments:
  <sdk>  The new sdk value. Git url and tag/branch/rev can be supplied at the same time or separately.
         Example usage:
         set-sdk "git: https://git@gitlab.com/partisiablockchain/language/contract-sdk.git, tag: 9.1.2"
         set-sdk "branch: example_branch"
         set-sdk "rev: 55061d796e5547e3cdf637407d928f95e2e32c59"

Options:
      --workspace                      Set the sdk for all packages in the workspace
      --manifest-path <MANIFEST_PATH>  Specify path to the Cargo.toml of the contract or workspace
  -p, --package <PACKAGE>              Build only the specified packages
  -h, --help                           Print help
transaction
Usage: cargo pbc transaction [-hv] [--net=<netname>] COMMAND
Builds, signs and sends transactions.
  -h, --help            Print usage description of the command.
      --net=<netname>   The blockchain net to target. To see all named nets,
                          run "cargo pbc config net -l".
                        "mainnet"  Target the mainnet
                        "testnet"  Target the testnet
                        <reader-url>  Target a custom net (with no browser)
                        <reader-url>,<browser-url>  Target a custom net with a
                          custom browser.
  -v, --verbose         Print all available information. Default is to print
                          minimum information.
Commands:
  action   Build, sign and send a transaction that calls a specific action with
             parameters. Uses the contract ABI.
  deploy   Build, sign and send a transaction that deploys a new smart-contract
             to the blockchain.
  raw      Build, sign and send a transaction with specific rpc bytes.
  sign     Sign a prebuilt unsigned transaction loaded from a binary file.
  send     Send a prebuilt signed transaction loaded from a binary file.
  show     Show information about a transaction and all its spawned sub-events
             (as JSON).
  latest   Get the latest transactions from the blockchain.
  upgrade  Build, sign and send a transaction that upgrades a smart-contract on
             the blockchain.
account
Usage: cargo pbc account [-hv] [--net=<netname>] COMMAND
Account creation and information about accounts on the Partisia Blockchain.
  -h, --help            Print usage description of the command.
      --net=<netname>   The blockchain net to target. To see all named nets,
                          run "cargo pbc config net -l".
                        "mainnet"  Target the mainnet
                        "testnet"  Target the testnet
                        <reader-url>  Target a custom net (with no browser)
                        <reader-url>,<browser-url>  Target a custom net with a
                          custom browser.
  -v, --verbose         Print all available information. Default is to print
                          minimum information.
Commands:
  create   Create a private key and print the associated address on the
             blockchain.
           By default, the private key will be output to the file '<address>.
             pk'.
           If the target is the Testnet, then the account is also filled with
             gas.
  show     Show information about an account (as JSON).
  mintgas  Mint gas for the given account. (This is only possible on the
             testnet)
  address  Print the blockchain address for a given private key.
contract
Usage: cargo pbc contract [-hv] [--net=<netname>] COMMAND
Interacts with contracts.
  -h, --help            Print usage description of the command.
      --net=<netname>   The blockchain net to target. To see all named nets,
                          run "cargo pbc config net -l".
                        "mainnet"  Target the mainnet
                        "testnet"  Target the testnet
                        <reader-url>  Target a custom net (with no browser)
                        <reader-url>,<browser-url>  Target a custom net with a
                          custom browser.
  -v, --verbose         Print all available information. Default is to print
                          minimum information.
Commands:
  show       Show information about a contract (as JSON).
  standard   Get information on contract and token standards.
  secret     Interact with secrets from a Zk contract.
  refuelgas  Build, sign and send a transaction that adds more gas to a
               contract.
config
Usage: cargo pbc config [-hv] [--net=<netname>] COMMAND
Set default values for options used during execution of commands.
  -h, --help            Print usage description of the command.
      --net=<netname>   The blockchain net to target. To see all named nets,
                          run "cargo pbc config net -l".
                        "mainnet"  Target the mainnet
                        "testnet"  Target the testnet
                        <reader-url>  Target a custom net (with no browser)
                        <reader-url>,<browser-url>  Target a custom net with a
                          custom browser.
  -v, --verbose         Print all available information. Default is to print
                          minimum information.
Commands:
  privatekey  Set the default private key to be used.
  net         Set the net option to be used during runtime.
  list        List the configurations set.
block
Usage: cargo pbc block [-hv] [--net=<netname>] COMMAND
View latest or specific blocks
  -h, --help            Print usage description of the command.
      --net=<netname>   The blockchain net to target. To see all named nets,
                          run "cargo pbc config net -l".
                        "mainnet"  Target the mainnet
                        "testnet"  Target the testnet
                        <reader-url>  Target a custom net (with no browser)
                        <reader-url>,<browser-url>  Target a custom net with a
                          custom browser.
  -v, --verbose         Print all available information. Default is to print
                          minimum information.
Commands:
  show    Show information about a block (as JSON).
  latest  Get the latest blocks from the blockchain
wallet
Usage: cargo pbc wallet [-hv] [--net=<netname>] COMMAND
Wallet creation. A wallet contains multiple accounts.
  -h, --help            Print usage description of the command.
      --net=<netname>   The blockchain net to target. To see all named nets,
                          run "cargo pbc config net -l".
                        "mainnet"  Target the mainnet
                        "testnet"  Target the testnet
                        <reader-url>  Target a custom net (with no browser)
                        <reader-url>,<browser-url>  Target a custom net with a
                          custom browser.
  -v, --verbose         Print all available information. Default is to print
                          minimum information.
Commands:
  create  Create a new wallet and save it to a file
          (by default the file is ~/.pbc/id_pbc ).
          A wallet consists of a 12-word mnemonic phrase,
          which is used to derive private keys that can be used on the
            blockchain.
          If the target is the Testnet, then the first account is also filled
            with gas.
abi
Usage: cargo pbc abi [-hv] [--lenient] [--net=<netname>] COMMAND
Interact with ABI files.
  -h, --help            Print usage description of the command.
      --lenient         Allow invalid Java identifiers.
      --net=<netname>   The blockchain net to target. To see all named nets,
                          run "cargo pbc config net -l".
                        "mainnet"  Target the mainnet
                        "testnet"  Target the testnet
                        <reader-url>  Target a custom net (with no browser)
                        <reader-url>,<browser-url>  Target a custom net with a
                          custom browser.
  -v, --verbose         Print all available information. Default is to print
                          minimum information.
Commands:
  show     Show basic information about an abi
  codegen  Generate code to interact with a contract based on an abi.
How to use
Go into the rust project containing your Cargo.toml and the contract.

An example for a contract written in rust can be found here.

When you are standing in the directory, run the following command to compile the contract and generate the ABI.

cargo partisia-contract build --release
This will build and write the contract and ABI files in the target/wasm32-unknown-unknown/debug.

If you run it with the flag --release, then the files will be in target/wasm32-unknown-unknown/release.