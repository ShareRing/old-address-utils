# old-address-utils

This utility is for those who have lost access to old Shareledger address with the same passphrase.

It does two main things:

1. Generate both old and new Shareledger address so that you can verify whether you have the right addresses from the right passphrase.
2. Some utility functions to 
    - transfer SHR from old address to new address;
    - undelegate your delegations in old address (if any); or
    - claim rewards in old address (if any)

## Usage

### Pre-built binaries

Go to [Releases](https://github.com/ShareRing/old-address-utils/releases) page and download the latest version. Pre-built binaries support 3 platforms: Linux x64, Windows x64 and Mac arm64.

**Linux**

You will need to grant executable permission on the downloaded file:

```sh
chmod +x old-address-utils-linux-x64
```

**MacOS**

Executable permission is also needed. Apart of that you may be required to `Allow` the executable to run by go to System Settings -> Privacy Policy


### From source

Make sure you have the following installed on your machine.

- Git
- Node 14+

1. Clone the repo


    ```sh

    git clone https://github.com/orgs/ShareRing/old-address-utils.git

    ```

2. Install dependencies

    ```sh
    cd old-address-utils
    npm i
    ```

3. Run

    ```sh
    node index
    ```

### Build binaries

We use `pkg` to package the code into executable. Please refer to it's (documentation)[https://github.com/vercel/pkg] for the details

Here's the basics:

1. Install `pkg` globally

    ```sh
    npm i -g pkg
    ```

2. Build

    ```sh
    pkg -t node16-macos-arm64,node16-win-x64,node16-linux-x64 -C GZip -o old-address-utils index.js
    ```

## Credits

- [cosmos-sdk](https://github.com/cosmos/cosmos-sdk)
- [bignumber.js](https://github.com/MikeMcl/bignumber.js)
- [inquirer](https://github.com/SBoudrias/Inquirer.js)


---
ShareRing
