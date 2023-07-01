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

yarn verify 0xA9b72b7D1b8A71df0a1a8BF625E8a7E0c6A7984E --network truffle

yarn whitelist-open --network truffle

