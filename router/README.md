# CMD
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

brew update

brew doctor

export PATH="/usr/local/bin:$PATH"

brew install node

brew install git

npm install --global yarn

npm i -g truffle

npm i -g corepack

truffle dashboard

yarn install

yarn deploy --network truffle

yarn verify 0x43D6e1e891d4324Ee5A2bB12cE7c9f7075A7903B --network truffle

yarn whitelist-open --network truffle

